"""Info Screen HLS Broadcast — Pillow görseli + FFmpeg HLS stream.

Mimari:
  - generate_info_screen_image(db) → /tmp/info_screen.png
  - FFmpeg: image loop → HLS  → /var/www/vod-manager/shared/hls/info_screen/stream.m3u8
  - Her 30 saniyede bir görsel yenilenir (thread loop)
  - Durum /tmp/info_screen_state.json'da tutulur (PID + started_at)
  - server_id verilirse SSH ile uzak sunucuda FFmpeg çalışır

API çağrısı:
  start_info_screen_stream(db, server_id=None) → {"ok": True, "stream_url": "..."}
  stop_info_screen_stream()    → {"ok": True}
  get_info_screen_stream_status() → {"running": bool, "stream_url": str}
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

HLS_DIR = Path("/var/www/vod-manager/shared/hls/info_screen")
IMAGE_PATH = "/tmp/info_screen.png"
STATE_FILE = "/tmp/info_screen_state.json"
STREAM_URL = "http://62.210.92.252/hls/info_screen/stream.m3u8"
REFRESH_INTERVAL = 30  # saniye

# Thread referansı
_refresh_thread: threading.Thread | None = None
_stop_event = threading.Event()


# ── State helpers ──────────────────────────────────────────────────────────────

def _write_state(pid: int | None, running: bool, remote: bool = False) -> None:
    state = {
        "pid": pid,
        "running": running,
        "remote": remote,
        "started_at": datetime.now(timezone.utc).isoformat() if running else None,
        "stream_url": STREAM_URL if running else None,
    }
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass


def _read_state() -> dict[str, Any]:
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"pid": None, "running": False, "remote": False, "started_at": None, "stream_url": None}


def _is_process_running(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return os.path.exists(f"/proc/{pid}")


# ── Server helpers ─────────────────────────────────────────────────────────────

def _get_server_info(db: Session, server_id: int) -> dict[str, Any] | None:
    """Sunucu SSH bilgilerini getir."""
    try:
        from app.modules.servers.models import Server
        srv = db.query(Server).filter(Server.id == server_id).first()
        if not srv:
            return None
        return {
            "ip": srv.ip_address,
            "ssh_port": getattr(srv, "ssh_port", 22) or 22,
            "ssh_user": getattr(srv, "ssh_username", "root") or "root",
            "ssh_password": getattr(srv, "ssh_password", None),
        }
    except Exception:
        return None


def _is_main_server(server_id: int | None, db: Session) -> bool:
    """server_id ana sunucu mu?"""
    if server_id is None:
        return True
    try:
        from app.modules.servers.models import Server
        srv = db.query(Server).filter(Server.id == server_id).first()
        if not srv:
            return True
        # Ana sunucu IP'si
        import socket
        main_ip = "62.210.92.252"
        return srv.ip_address in (main_ip, "127.0.0.1", "localhost", socket.gethostname())
    except Exception:
        return True


# ── FFmpeg helpers ─────────────────────────────────────────────────────────────

def _build_ffmpeg_args() -> list[str]:
    stream_dir = str(HLS_DIR)
    return [
        "ffmpeg", "-y",
        "-loop", "1",
        "-framerate", "1",
        "-i", IMAGE_PATH,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "stillimage",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-r", "25",
        "-g", "50",
        "-an",                         # ses yok
        "-f", "hls",
        "-hls_time", "4",
        "-hls_list_size", "10",
        "-hls_flags", "delete_segments+append_list+omit_endlist",
        "-hls_segment_filename", f"{stream_dir}/seg_%05d.ts",
        f"{stream_dir}/stream.m3u8",
    ]


def _kill_existing() -> None:
    """Önceki info_screen ffmpeg process'lerini öldür."""
    try:
        subprocess.run(
            ["pkill", "-TERM", "-f", "info_screen/stream.m3u8"],
            capture_output=True,
        )
    except Exception:
        pass
    time.sleep(1)


def _start_ffmpeg_local() -> int:
    """FFmpeg'i yerel makinede başlatır, PID döndürür."""
    HLS_DIR.mkdir(parents=True, exist_ok=True)
    args = _build_ffmpeg_args()
    log_path = str(HLS_DIR / "ffmpeg.log")
    proc = subprocess.Popen(
        args,
        stdout=open(log_path, "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return proc.pid


def _start_ffmpeg_remote(server_info: dict[str, Any]) -> int:
    """SSH üzerinden uzak sunucuda FFmpeg başlatır.

    Uzak sunucuda da aynı HLS_DIR yolunun mevcut olduğu varsayılır
    (veya NFS/SSHFS ile paylaşılmış). Uzak PID -1 olarak döner (takip edilmez).
    """
    try:
        import paramiko  # type: ignore
    except ImportError:
        # paramiko yoksa subprocess ile sshpass dene
        return _start_ffmpeg_remote_subprocess(server_info)

    hls_dir = str(HLS_DIR)
    ffmpeg_cmd = (
        f"mkdir -p {hls_dir} && "
        f"nohup ffmpeg -y -loop 1 -framerate 1 -i {IMAGE_PATH} "
        f"-c:v libx264 -preset ultrafast -tune stillimage -crf 23 -pix_fmt yuv420p "
        f"-r 25 -g 50 -an "
        f"-f hls -hls_time 4 -hls_list_size 10 "
        f"-hls_flags delete_segments+append_list+omit_endlist "
        f"-hls_segment_filename '{hls_dir}/seg_%05d.ts' "
        f"'{hls_dir}/stream.m3u8' "
        f"> {hls_dir}/ffmpeg.log 2>&1 & echo $!"
    )
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=server_info["ip"],
            port=server_info["ssh_port"],
            username=server_info["ssh_user"],
            password=server_info.get("ssh_password"),
            timeout=10,
        )
        _, stdout, _ = client.exec_command(ffmpeg_cmd)
        pid_str = stdout.read().decode().strip()
        client.close()
        return int(pid_str) if pid_str.isdigit() else -1
    except Exception:
        return -1


def _start_ffmpeg_remote_subprocess(server_info: dict[str, Any]) -> int:
    """sshpass ile SSH komut çalıştır (paramiko yoksa fallback)."""
    hls_dir = str(HLS_DIR)
    ffmpeg_cmd = (
        f"mkdir -p {hls_dir} && "
        f"nohup ffmpeg -y -loop 1 -framerate 1 -i {IMAGE_PATH} "
        f"-c:v libx264 -preset ultrafast -tune stillimage -crf 23 -pix_fmt yuv420p "
        f"-r 25 -g 50 -an "
        f"-f hls -hls_time 4 -hls_list_size 10 "
        f"-hls_flags delete_segments+append_list+omit_endlist "
        f"-hls_segment_filename '{hls_dir}/seg_%05d.ts' "
        f"'{hls_dir}/stream.m3u8' "
        f"> {hls_dir}/ffmpeg.log 2>&1 & echo $!"
    )
    try:
        cmd = [
            "sshpass", "-p", server_info.get("ssh_password", ""),
            "ssh", "-o", "StrictHostKeyChecking=no",
            "-p", str(server_info["ssh_port"]),
            f"{server_info['ssh_user']}@{server_info['ip']}",
            ffmpeg_cmd,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        pid_str = result.stdout.strip()
        return int(pid_str) if pid_str.isdigit() else -1
    except Exception:
        return -1


# ── Refresh thread ─────────────────────────────────────────────────────────────

def _refresh_loop(db_factory, initial_pid: int, server_id: int | None) -> None:
    """REFRESH_INTERVAL saniyede bir görsel yeniler, FFmpeg'e sinyal gönderir."""
    current_pid = initial_pid
    while not _stop_event.is_set():
        _stop_event.wait(REFRESH_INTERVAL)
        if _stop_event.is_set():
            break
        # Yeni görsel oluştur
        try:
            db: Session = db_factory()
            try:
                from app.modules.playlist.info_screen_generator import generate_info_screen_image
                generate_info_screen_image(db)
            finally:
                db.close()
        except Exception:
            # Görsel yenilenemezse eski kalır — stream devam eder
            pass

        # FFmpeg hâlâ çalışıyor mu? (sadece yerel PID için)
        if current_pid != -1 and not _is_process_running(current_pid):
            # Restart
            _kill_existing()
            try:
                current_pid = _start_ffmpeg_local()
                _write_state(current_pid, True)
            except Exception:
                pass


# ── Public API ─────────────────────────────────────────────────────────────────

def start_info_screen_stream(db: Session, server_id: int | None = None) -> dict[str, Any]:
    global _refresh_thread, _stop_event

    # Önceki stream'i durdur
    _kill_existing()

    # İlk görseli oluştur
    from app.modules.playlist.info_screen_generator import generate_info_screen_image
    generate_info_screen_image(db)

    # server_id verilmişse ve ana sunucu değilse SSH ile başlat
    use_remote = False
    if server_id is not None and not _is_main_server(server_id, db):
        server_info = _get_server_info(db, server_id)
        if server_info:
            pid = _start_ffmpeg_remote(server_info)
            use_remote = True
        else:
            pid = _start_ffmpeg_local()
    else:
        pid = _start_ffmpeg_local()

    _write_state(pid, True, remote=use_remote)

    # Refresh thread'i başlat
    _stop_event.clear()

    from app.core.database import SessionLocal
    def _db_factory():
        return SessionLocal()

    _refresh_thread = threading.Thread(
        target=_refresh_loop,
        args=(_db_factory, pid, server_id),
        daemon=True,
        name="info_screen_refresh",
    )
    _refresh_thread.start()

    return {"ok": True, "pid": pid, "stream_url": STREAM_URL, "remote": use_remote}


def stop_info_screen_stream() -> dict[str, Any]:
    global _refresh_thread, _stop_event

    # Thread'i durdur
    _stop_event.set()
    if _refresh_thread and _refresh_thread.is_alive():
        _refresh_thread.join(timeout=5)
    _refresh_thread = None

    # FFmpeg'i öldür
    state = _read_state()
    pid = state.get("pid")
    if pid and pid != -1:
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except Exception:
            pass
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    _kill_existing()

    _write_state(None, False)
    return {"ok": True}


def get_info_screen_stream_status() -> dict[str, Any]:
    state = _read_state()
    pid = state.get("pid")
    is_remote = state.get("remote", False)

    # Uzak stream için PID takibi mümkün değil — state'e güvenelim
    if is_remote:
        running = bool(state.get("running"))
    else:
        running = bool(state.get("running")) and _is_process_running(pid)

    if not running and state.get("running"):
        # Tutarsız durum — state'i güncelle
        _write_state(None, False)

    return {
        "running": running,
        "pid": pid if running else None,
        "stream_url": STREAM_URL if running else None,
        "started_at": state.get("started_at") if running else None,
        "remote": is_remote,
    }
