from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.openvpn.models import VpnClient, VpnServerConfig
from app.modules.openvpn.schemas import VpnClientCreate, VpnServerConfigUpdate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_server_config(db: Session) -> VpnServerConfig:
    cfg = db.query(VpnServerConfig).first()
    if cfg is None:
        cfg = VpnServerConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _run(cmd: list[str], cwd: str | None = None, env: dict | None = None) -> str:
    """Run a shell command and return combined stdout+stderr. Raise on failure."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        env=env or os.environ.copy(),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr or result.stdout}")
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# PKI bootstrap
# ---------------------------------------------------------------------------

def ensure_pki_initialized(cfg: VpnServerConfig) -> None:
    """Ensure easy-rsa PKI is set up: init-pki, CA, server cert, DH, ta.key."""
    easy_rsa = Path(cfg.easy_rsa_dir)
    pki = easy_rsa / "pki"
    env = os.environ.copy()
    env.setdefault("EASYRSA_BATCH", "1")
    env.setdefault("EASYRSA_REQ_CN", "VODManagerCA")

    if not pki.exists():
        _run(["./easyrsa", "init-pki"], cwd=str(easy_rsa), env=env)

    ca_cert = Path(cfg.ca_cert_path)
    if not ca_cert.exists():
        _run(["./easyrsa", "build-ca", "nopass"], cwd=str(easy_rsa), env=env)

    server_cert = Path(cfg.server_cert_path)
    if not server_cert.exists():
        _run(["./easyrsa", "build-server-full", "server", "nopass"], cwd=str(easy_rsa), env=env)

    dh = Path(cfg.dh_params_path)
    if not dh.exists():
        _run(["./easyrsa", "gen-dh"], cwd=str(easy_rsa), env=env)

    ta_key = Path(cfg.ta_key_path)
    if not ta_key.exists():
        ta_key.parent.mkdir(parents=True, exist_ok=True)
        _run(["openvpn", "--genkey", "secret", str(ta_key)])


# ---------------------------------------------------------------------------
# Client cert generation
# ---------------------------------------------------------------------------

def generate_client_certificate(db: Session, name: str) -> VpnClient:
    """Generate a client certificate using easy-rsa and return the VpnClient."""
    cfg = _get_or_create_server_config(db)

    # Sanitize name (extra safety on top of schema validation)
    safe_name = name.strip().replace(" ", "_")

    easy_rsa = Path(cfg.easy_rsa_dir)
    clients_dir = Path(cfg.clients_dir)
    clients_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.setdefault("EASYRSA_BATCH", "1")

    try:
        ensure_pki_initialized(cfg)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PKI baslatilamadi: {exc}",
        ) from exc

    # Generate client cert
    try:
        _run(
            ["./easyrsa", "build-client-full", safe_name, "nopass"],
            cwd=str(easy_rsa),
            env=env,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sertifika olusturulamadi: {exc}",
        ) from exc

    pki = easy_rsa / "pki"
    cert_path = str(pki / "issued" / f"{safe_name}.crt")
    key_path = str(pki / "private" / f"{safe_name}.key")

    client = VpnClient(
        name=safe_name,
        cert_path=cert_path,
        key_path=key_path,
        is_active=True,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


# ---------------------------------------------------------------------------
# .ovpn file builder
# ---------------------------------------------------------------------------

def build_ovpn_content(client: VpnClient, cfg: VpnServerConfig) -> str:
    """Build .ovpn file content with embedded certs."""
    def read_file(path: str) -> str:
        p = Path(path)
        if not p.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Dosya bulunamadi: {path}",
            )
        return p.read_text().strip()

    ca_cert = read_file(cfg.ca_cert_path)
    client_cert_raw = read_file(client.cert_path)  # type: ignore[arg-type]
    client_key = read_file(client.key_path)  # type: ignore[arg-type]

    # Extract only the certificate block from the .crt file
    cert_start = client_cert_raw.find("-----BEGIN CERTIFICATE-----")
    if cert_start != -1:
        client_cert = client_cert_raw[cert_start:]
    else:
        client_cert = client_cert_raw

    ta_key_content = ""
    ta_key_path = Path(cfg.ta_key_path)
    if ta_key_path.exists():
        try:
            ta_key_content = ta_key_path.read_text().strip()
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"ta.key dosyasi okunamadi: izin hatasi ({cfg.ta_key_path}). "
                       f"Sunucuda: chmod 640 {cfg.ta_key_path} && chown root:www-data {cfg.ta_key_path}",
            )

    lines = [
        "client",
        f"remote {cfg.server_ip} {cfg.server_port}",
        f"proto {cfg.protocol}",
        "dev tun",
        "resolv-retry infinite",
        "nobind",
        "persist-key",
        "persist-tun",
        "remote-cert-tls server",
        "cipher AES-256-GCM",
        "auth SHA256",
        "verb 3",
        "",
        "<ca>",
        ca_cert,
        "</ca>",
        "",
        "<cert>",
        client_cert,
        "</cert>",
        "",
        "<key>",
        client_key,
        "</key>",
    ]

    if ta_key_content:
        lines += [
            "",
            "key-direction 1",
            "<tls-auth>",
            ta_key_content,
            "</tls-auth>",
        ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

def list_clients(db: Session) -> list[VpnClient]:
    return db.query(VpnClient).order_by(VpnClient.created_at.desc()).all()


def get_client(db: Session, client_id: int) -> VpnClient:
    client = db.query(VpnClient).filter(VpnClient.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VPN istemcisi bulunamadi")
    return client


def get_client_ovpn_bytes(db: Session, client_id: int) -> tuple[str, bytes]:
    """Return (filename, ovpn_bytes) for the client."""
    client = get_client(db, client_id)
    if not client.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sertifika iptal edilmis")
    cfg = _get_or_create_server_config(db)
    content = build_ovpn_content(client, cfg)
    filename = f"{client.name}.ovpn"
    return filename, content.encode("utf-8")


def create_client(db: Session, payload: VpnClientCreate, user_id: int | None = None) -> VpnClient:
    existing = db.query(VpnClient).filter(VpnClient.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{payload.name}' adli istemci zaten mevcut",
        )
    client = generate_client_certificate(db, payload.name)
    client.description = payload.description
    client.user_id = user_id
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def revoke_client(db: Session, client_id: int) -> None:
    client = get_client(db, client_id)
    cfg = _get_or_create_server_config(db)
    easy_rsa = Path(cfg.easy_rsa_dir)

    env = os.environ.copy()
    env.setdefault("EASYRSA_BATCH", "1")

    try:
        _run(
            ["./easyrsa", "revoke", client.name],
            cwd=str(easy_rsa),
            env=env,
        )
        _run(
            ["./easyrsa", "gen-crl"],
            cwd=str(easy_rsa),
            env=env,
        )
    except RuntimeError:
        # If cert doesn't exist on disk, still mark inactive
        pass

    client.is_active = False
    db.add(client)
    db.commit()


def delete_client(db: Session, client_id: int) -> None:
    client = get_client(db, client_id)
    revoke_client(db, client_id)
    db.delete(client)
    db.commit()


# ---------------------------------------------------------------------------
# Server config
# ---------------------------------------------------------------------------

def get_server_config(db: Session) -> VpnServerConfig:
    return _get_or_create_server_config(db)


def update_server_config(db: Session, payload: VpnServerConfigUpdate) -> VpnServerConfig:
    cfg = _get_or_create_server_config(db)
    cfg.server_ip = payload.server_ip
    cfg.server_port = payload.server_port
    cfg.protocol = payload.protocol
    cfg.ca_cert_path = payload.ca_cert_path
    cfg.server_cert_path = payload.server_cert_path
    cfg.server_key_path = payload.server_key_path
    cfg.dh_params_path = payload.dh_params_path
    cfg.ta_key_path = payload.ta_key_path
    cfg.easy_rsa_dir = payload.easy_rsa_dir
    cfg.clients_dir = payload.clients_dir
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg
