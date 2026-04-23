from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import paramiko
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.security import decrypt_secret, encrypt_secret
from app.modules.servers.models import (
    InstallStepStatus,
    Server,
    ServerInstallLog,
    ServerMetric,
    ServerStatus,
    ServerType,
)
from app.modules.servers.schemas import ServerCheckPayload, ServerConnectionPayload, ServerCreate, ServerUpdate


def _ssh_client(ip_address: str, ssh_port: int, username: str, password: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=ip_address,
        port=ssh_port,
        username=username,
        password=password,
        timeout=settings.SSH_TIMEOUT_SECONDS,
        auth_timeout=settings.SSH_TIMEOUT_SECONDS,
        banner_timeout=settings.SSH_TIMEOUT_SECONDS,
    )
    return client


def _exec_command(client: paramiko.SSHClient, command: str, timeout: int | None = None) -> str:
    stdin, stdout, stderr = client.exec_command(
        command,
        timeout=timeout or settings.COMMAND_TIMEOUT_SECONDS,
    )
    exit_code = stdout.channel.recv_exit_status()
    output = stdout.read().decode(errors="replace").strip()
    error = stderr.read().decode(errors="replace").strip()
    if exit_code != 0:
        raise RuntimeError(error or output or f"Komut basarisiz: {command}")
    return output


def _safe_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(float(value.strip()))
    except (TypeError, ValueError):
        return None


def _safe_float(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return round(float(value.strip()), 2)
    except (TypeError, ValueError):
        return 0.0


def _fetch_server_facts(client: paramiko.SSHClient) -> dict[str, Any]:
    os_info = _exec_command(client, "uname -srvmo || cat /etc/os-release | head -n 1")
    cpu_info = _exec_command(
        client,
        "sh -lc \"grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | xargs echo || nproc\"",
    )
    ram_total = _safe_int(_exec_command(client, "free -m | awk '/Mem:/ {print $2}'"))
    disk_total = _safe_int(_exec_command(client, "df -BM / | awk 'NR==2 {gsub(/M/, \"\", $2); print $2}'"))
    return {
        "os_info": os_info or None,
        "cpu_info": cpu_info or None,
        "ram_total": ram_total,
        "disk_total": disk_total,
    }


def test_connection_payload(payload: ServerCheckPayload) -> dict[str, Any]:
    try:
        client = _ssh_client(
            str(payload.ip_address),
            payload.ssh_port,
            payload.ssh_username,
            payload.ssh_password,
        )
        try:
            facts = _fetch_server_facts(client)
        finally:
            client.close()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SSH baglanti testi basarisiz: {exc}",
        ) from exc

    return {
        "ok": True,
        "message": "SSH baglantisi basarili",
        **facts,
    }


def ensure_main_server(db: Session) -> Server:
    existing = db.query(Server).filter(Server.server_type == ServerType.main).first()
    encrypted_password = encrypt_secret(settings.MAIN_SERVER_SSH_PASSWORD or "placeholder-main-password")
    if existing:
        existing.name = settings.MAIN_SERVER_NAME
        existing.ip_address = settings.MAIN_SERVER_IP
        existing.ssh_port = settings.MAIN_SERVER_SSH_PORT
        existing.ssh_username = settings.MAIN_SERVER_SSH_USERNAME
        existing.ssh_password = encrypted_password
        existing.server_type = ServerType.main
        if existing.status == ServerStatus.installing:
            existing.status = ServerStatus.online
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    server = Server(
        name=settings.MAIN_SERVER_NAME,
        ip_address=settings.MAIN_SERVER_IP,
        ssh_port=settings.MAIN_SERVER_SSH_PORT,
        ssh_username=settings.MAIN_SERVER_SSH_USERNAME,
        ssh_password=encrypted_password,
        server_type=ServerType.main,
        status=ServerStatus.online,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def _with_latest_metric(server: Server) -> Server:
    latest_metric = None
    if server.metrics:
        latest_metric = max(server.metrics, key=lambda metric: metric.collected_at or datetime.min.replace(tzinfo=timezone.utc))
    setattr(server, "latest_metric", latest_metric)
    return server


def list_servers(db: Session) -> list[Server]:
    ensure_main_server(db)
    servers = (
        db.query(Server)
        .options(joinedload(Server.metrics))
        .order_by(Server.server_type.asc(), Server.name.asc())
        .all()
    )
    return [_with_latest_metric(server) for server in servers]


def get_server(db: Session, server_id: int) -> Server:
    server = (
        db.query(Server)
        .options(joinedload(Server.metrics), joinedload(Server.install_logs))
        .filter(Server.id == server_id)
        .first()
    )
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sunucu bulunamadi")
    return _with_latest_metric(server)


def create_server(db: Session, payload: ServerCreate) -> Server:
    ensure_main_server(db)
    existing = db.query(Server).filter(Server.ip_address == str(payload.ip_address)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu IP adresi zaten kayitli")

    facts: dict[str, Any] = {}
    try:
        facts = test_connection_payload(payload)
    except HTTPException:
        pass  # SSH baglantisi basarisiz – sunucu offline olarak eklenir, worker sonra gunceller

    # SSH basarili olduysa kurulum baslatilabilir, basarisizsa offline kalir
    initial_status = ServerStatus.installing if facts else ServerStatus.offline

    server = Server(
        name=payload.name.strip(),
        ip_address=str(payload.ip_address),
        ssh_port=payload.ssh_port,
        ssh_username=payload.ssh_username.strip(),
        ssh_password=encrypt_secret(payload.ssh_password),
        server_type=ServerType.loadbalancer,
        status=initial_status,
        os_info=facts.get("os_info"),
        cpu_info=facts.get("cpu_info"),
        ram_total=facts.get("ram_total"),
        disk_total=facts.get("disk_total"),
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return _with_latest_metric(server)


def update_server(db: Session, server_id: int, payload: ServerUpdate) -> Server:
    server = get_server(db, server_id)
    if payload.name is not None:
        server.name = payload.name.strip()
    if payload.ip_address is not None and server.server_type != ServerType.main:
        server.ip_address = payload.ip_address.strip()
    if payload.ssh_port is not None:
        server.ssh_port = payload.ssh_port
    if payload.ssh_username is not None:
        server.ssh_username = payload.ssh_username.strip()
    if payload.ssh_password is not None:
        server.ssh_password = encrypt_secret(payload.ssh_password)
    if payload.domain_name is not None:
        server.domain_name = payload.domain_name.strip() or None
    if payload.max_clients is not None:
        server.max_clients = payload.max_clients
    if payload.network_interface is not None:
        server.network_interface = payload.network_interface.strip() or None
    if payload.network_speed is not None:
        server.network_speed = payload.network_speed
    if payload.http_port is not None:
        server.http_port = payload.http_port
    if payload.https_port is not None:
        server.https_port = payload.https_port
    if payload.rtmp_port is not None:
        server.rtmp_port = payload.rtmp_port
    if server.server_type == ServerType.main:
        server.server_type = ServerType.main
    db.add(server)
    db.commit()
    db.refresh(server)
    return _with_latest_metric(server)


def delete_server(db: Session, server_id: int) -> None:
    server = get_server(db, server_id)
    if server.server_type == ServerType.main:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Main Server silinemez")
    db.delete(server)
    db.commit()


def check_server(db: Session, server_id: int) -> dict[str, Any]:
    server = get_server(db, server_id)
    payload = ServerCheckPayload(
        ip_address=server.ip_address,
        ssh_port=server.ssh_port,
        ssh_username=server.ssh_username,
        ssh_password=decrypt_secret(server.ssh_password),
    )
    try:
        result = test_connection_payload(payload)
        server.status = ServerStatus.online if server.server_type == ServerType.main else ServerStatus.offline
        server.os_info = result.get("os_info")
        server.cpu_info = result.get("cpu_info")
        server.ram_total = result.get("ram_total")
        server.disk_total = result.get("disk_total")
        db.add(server)
        db.commit()
        return result
    except HTTPException as exc:
        server.status = ServerStatus.error if server.server_type == ServerType.loadbalancer else ServerStatus.offline
        db.add(server)
        db.commit()
        raise exc


def get_latest_metrics(db: Session, server_id: int) -> ServerMetric | None:
    get_server(db, server_id)
    return (
        db.query(ServerMetric)
        .filter(ServerMetric.server_id == server_id)
        .order_by(ServerMetric.collected_at.desc())
        .first()
    )


def get_metric_history(db: Session, server_id: int) -> list[ServerMetric]:
    get_server(db, server_id)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    return (
        db.query(ServerMetric)
        .filter(ServerMetric.server_id == server_id, ServerMetric.collected_at >= since)
        .order_by(ServerMetric.collected_at.asc())
        .all()
    )


def _log_install_step(db: Session, server_id: int, step: str, status_value: InstallStepStatus, message: str) -> None:
    db.add(
        ServerInstallLog(
            server_id=server_id,
            step=step,
            status=status_value,
            message=message,
        )
    )
    db.commit()


INSTALL_STEPS: list[tuple[str, str]] = [
    ("Baglanti kuruluyor", "echo connection-ok"),
    ("Sistem guncelleniyor", "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y"),
    ("Temel paketler kuruluyor", "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx python3 python3-venv ffmpeg redis-server"),
    ("yt-dlp kuruluyor", "curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp"),
    ("Uygulama dizinleri olusturuluyor", "mkdir -p /var/www/vod-manager/shared/movies /var/www/vod-manager/shared/series /var/www/vod-manager/shared/downloads /var/www/vod-manager/shared/logs && chmod -R 755 /var/www/vod-manager"),
]


def run_installation(db: Session, server_id: int) -> None:
    server = get_server(db, server_id)
    if server.server_type == ServerType.main:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Main Server icin kurulum tetiklenemez")

    db.query(ServerInstallLog).filter(ServerInstallLog.server_id == server_id).delete()
    server.status = ServerStatus.installing
    db.add(server)
    db.commit()

    client: paramiko.SSHClient | None = None
    try:
        client = _ssh_client(server.ip_address, server.ssh_port, server.ssh_username, decrypt_secret(server.ssh_password))
        for step, command in INSTALL_STEPS:
            _log_install_step(db, server_id, step, InstallStepStatus.running, f"{step} baslatildi")
            _exec_command(client, command)
            _log_install_step(db, server_id, step, InstallStepStatus.completed, f"{step} tamamlandi")
        server.status = ServerStatus.online
        facts = _fetch_server_facts(client)
        server.os_info = facts.get("os_info")
        server.cpu_info = facts.get("cpu_info")
        server.ram_total = facts.get("ram_total")
        server.disk_total = facts.get("disk_total")
        db.add(server)
        db.commit()
    except Exception as exc:
        server.status = ServerStatus.error
        db.add(server)
        db.commit()
        _log_install_step(db, server_id, "Kurulum hatasi", InstallStepStatus.failed, str(exc))
    finally:
        if client is not None:
            client.close()


def start_installation(db: Session, server_id: int) -> Server:
    server = get_server(db, server_id)
    if server.server_type == ServerType.main:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Main Server icin kurulum tetiklenemez")
    return server


def get_install_status(db: Session, server_id: int) -> dict[str, Any]:
    server = get_server(db, server_id)
    logs = (
        db.query(ServerInstallLog)
        .filter(ServerInstallLog.server_id == server_id)
        .order_by(ServerInstallLog.created_at.asc(), ServerInstallLog.id.asc())
        .all()
    )
    total_steps = len(INSTALL_STEPS)
    completed_steps = len([log for log in logs if log.status == InstallStepStatus.completed])
    running = next((log.step for log in reversed(logs) if log.status == InstallStepStatus.running), None)
    failed = any(log.status == InstallStepStatus.failed for log in logs)
    progress_percent = int((completed_steps / total_steps) * 100) if total_steps else 0
    if failed:
        progress_percent = min(progress_percent, 99)
    return {
        "server_id": server_id,
        "status": server.status.value if hasattr(server.status, "value") else str(server.status),
        "progress_percent": progress_percent,
        "total_steps": total_steps,
        "completed_steps": completed_steps,
        "running_step": running,
        "logs": logs,
    }


def restart_server(db: Session, server_id: int) -> dict[str, str]:
    server = get_server(db, server_id)
    if server.server_type == ServerType.main:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Main Server yeniden baslatma endpointi kapali")
    client = _ssh_client(server.ip_address, server.ssh_port, server.ssh_username, decrypt_secret(server.ssh_password))
    try:
        client.exec_command("nohup reboot >/dev/null 2>&1 &")
    finally:
        client.close()
    server.status = ServerStatus.offline
    db.add(server)
    db.commit()
    return {"message": "Yeniden baslatma komutu gonderildi"}


def _collect_metric_via_ssh(server: Server, previous_metric: ServerMetric | None) -> dict[str, Any]:
    client = _ssh_client(server.ip_address, server.ssh_port, server.ssh_username, decrypt_secret(server.ssh_password))
    try:
        cpu_percent = _safe_float(_exec_command(client, "top -bn1 | awk '/Cpu\\(s\\)/ {print 100 - $8}'"))
        ram_parts = _exec_command(client, "free -m | awk '/Mem:/ {print $3\" \"$2\" \"($3/$2)*100}'").split()
        disk_parts = _exec_command(client, "df -BM / | awk 'NR==2 {gsub(/M/, \"\", $3); gsub(/%/, \"\", $5); print $3\" \"$5}'").split()

        iface = (server.network_interface or "").strip()
        if iface:
            net_cmd = f"awk -F'[: ]+' '$2==\"{iface}\" {{print $3\" \"$11}}' /proc/net/dev"
        else:
            net_cmd = "awk -F'[: ]+' 'NR>2 && $2 != \"lo\" {rx+=$3; tx+=$11} END {print rx\" \"tx}' /proc/net/dev"

        network_parts = _exec_command(client, net_cmd).split()
        active_connections = _safe_int(_exec_command(client, "sh -lc \"ss -ant | tail -n +2 | wc -l\"")) or 0
        ram_used = _safe_int(ram_parts[0] if len(ram_parts) > 0 else None) or 0
        ram_percent = _safe_float(ram_parts[2] if len(ram_parts) > 2 else None)
        disk_used = _safe_int(disk_parts[0] if len(disk_parts) > 0 else None) or 0
        disk_percent = _safe_float(disk_parts[1] if len(disk_parts) > 1 else None)
        rx_bytes = _safe_int(network_parts[0] if len(network_parts) > 0 else None) or 0
        tx_bytes = _safe_int(network_parts[1] if len(network_parts) > 1 else None) or 0

        network_in_mbps = 0.0
        network_out_mbps = 0.0
        if previous_metric and previous_metric.collected_at:
            elapsed = max((datetime.now(timezone.utc) - previous_metric.collected_at).total_seconds(), 1)
            network_in_mbps = round(max(rx_bytes - previous_metric.network_rx_bytes, 0) * 8 / 1_000_000 / elapsed, 4)
            network_out_mbps = round(max(tx_bytes - previous_metric.network_tx_bytes, 0) * 8 / 1_000_000 / elapsed, 4)

        facts = _fetch_server_facts(client)
        return {
            "cpu_percent": cpu_percent,
            "ram_percent": ram_percent,
            "ram_used": ram_used,
            "disk_percent": disk_percent,
            "disk_used": disk_used,
            "network_in_mbps": network_in_mbps,
            "network_out_mbps": network_out_mbps,
            "active_connections": active_connections,
            "network_rx_bytes": rx_bytes,
            "network_tx_bytes": tx_bytes,
            "facts": facts,
        }
    finally:
        client.close()


def collect_metrics(db: Session) -> int:
    servers = db.query(Server).all()
    collected = 0
    for server in servers:
        previous_metric = (
            db.query(ServerMetric)
            .filter(ServerMetric.server_id == server.id)
            .order_by(ServerMetric.collected_at.desc())
            .first()
        )
        try:
            metric_data = _collect_metric_via_ssh(server, previous_metric)
            metric = ServerMetric(
                server_id=server.id,
                cpu_percent=metric_data["cpu_percent"],
                ram_percent=metric_data["ram_percent"],
                ram_used=metric_data["ram_used"],
                disk_percent=metric_data["disk_percent"],
                disk_used=metric_data["disk_used"],
                network_in_mbps=metric_data["network_in_mbps"],
                network_out_mbps=metric_data["network_out_mbps"],
                active_connections=metric_data["active_connections"],
                network_rx_bytes=metric_data["network_rx_bytes"],
                network_tx_bytes=metric_data["network_tx_bytes"],
            )
            db.add(metric)
            server.status = ServerStatus.online
            server.os_info = metric_data["facts"].get("os_info")
            server.cpu_info = metric_data["facts"].get("cpu_info")
            server.ram_total = metric_data["facts"].get("ram_total")
            server.disk_total = metric_data["facts"].get("disk_total")
            db.add(server)
            db.commit()
            collected += 1
        except Exception:
            server.status = ServerStatus.offline if server.server_type == ServerType.main else ServerStatus.error
            db.add(server)
            db.commit()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.METRICS_RETENTION_HOURS)
    db.query(ServerMetric).filter(ServerMetric.collected_at < cutoff).delete()
    db.commit()
    return collected