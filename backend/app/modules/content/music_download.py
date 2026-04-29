from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.content.models import MusicTrack


MUSIC_UPLOADS_ROOT = Path("/var/www/vod-manager/shared/uploads/music")


def _sanitize_filename(name: str) -> str:
    """Dosya adi icin guvenli karakter seti."""
    name = re.sub(r'[^\w\s\-.]', '', name, flags=re.UNICODE)
    name = re.sub(r'\s+', '_', name.strip())
    return name[:200] or "track"


def _get_tun0_address() -> str | None:
    """tun0 arayuzunun IPv4 adresini dondur, bulunamazsa None."""
    try:
        result = subprocess.run(
            ["ip", "-4", "addr", "show", "tun0"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("inet "):
                return line.split()[1].split("/")[0]
    except Exception:
        pass
    return None


def _find_vpn_config_path(vpn_client_id: int) -> str | None:
    """VPN client config dosyasini bul (openvpn clients dizininde)."""
    from app.core.database import SessionLocal as _SessionLocal
    from app.modules.openvpn.models import VpnClient, VpnServerConfig

    db = _SessionLocal()
    try:
        client = db.query(VpnClient).filter(VpnClient.id == vpn_client_id).first()
        cfg = db.query(VpnServerConfig).first()
        if not client or not cfg:
            return None
        clients_dir = Path(cfg.clients_dir)
        ovpn_path = clients_dir / f"{client.name}.ovpn"
        if ovpn_path.exists():
            return str(ovpn_path)
        # cert/key dosyalarindan inline config
        if client.cert_path and client.key_path:
            return client.name  # sadece isim dondur, inline kullan
        return None
    finally:
        db.close()


def _start_vpn(vpn_client_id: int) -> subprocess.Popen | None:
    """OpenVPN baslat. Proses nesnesini dondur."""
    config_path = _find_vpn_config_path(vpn_client_id)
    if not config_path:
        return None
    try:
        proc = subprocess.Popen(
            ["openvpn", "--config", config_path, "--daemon"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Baglanti kurulana kadar bekle (max 15 sn)
        for _ in range(15):
            time.sleep(1)
            if _get_tun0_address():
                break
        return proc
    except Exception:
        return None


def _stop_vpn() -> None:
    """Tun0 uzerindeki openvpn proseslerini durdur."""
    try:
        subprocess.run(["pkill", "-f", "openvpn"], capture_output=True)
        time.sleep(1)
    except Exception:
        pass


def download_music_from_youtube(
    url: str,
    title: str | None,
    artist: str | None,
    category_id: int | None,
    vpn_client_id: int | None,
) -> dict:
    """
    YouTube'dan MP3 indir ve MusicTrack olarak kaydet.
    Bu fonksiyon Celery task icinden cagrilir.
    """
    # Cikti dizini
    folder_name = str(category_id) if category_id else "uncategorized"
    output_dir = MUSIC_UPLOADS_ROOT / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    # Dosya adi
    safe_title = _sanitize_filename(title) if title else "%(title)s"
    output_path = output_dir / f"{safe_title}.%(ext)s"

    # yt-dlp komutu
    command = [
        "yt-dlp",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--no-warnings",
        "--restrict-filenames",
        "-o", str(output_path),
    ]

    # Cookies destegi
    cookies_path = settings.youtube_cookies_path
    if cookies_path.exists() and cookies_path.stat().st_size > 0:
        command.extend(["--cookies", str(cookies_path)])

    vpn_proc = None
    try:
        # VPN destegi
        if vpn_client_id:
            vpn_proc = _start_vpn(vpn_client_id)
            tun0_ip = _get_tun0_address()
            if tun0_ip:
                command.extend(["--source-address", tun0_ip])

        command.append(url)

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )

        if result.returncode != 0:
            raise RuntimeError(result.stderr or result.stdout or "yt-dlp basarisiz oldu")

        # Indirilen dosyayi bul
        candidates = sorted(output_dir.glob(f"{safe_title}.mp3"))
        if not candidates:
            # title bilmeden indirildiyse ilk mp3'u al
            candidates = sorted(output_dir.glob("*.mp3"))
        if not candidates:
            raise RuntimeError("Indirilen MP3 dosyasi bulunamadi")

        file_path = candidates[-1]

        # MusicTrack kaydet
        db = SessionLocal()
        try:
            track = MusicTrack(
                title=title or file_path.stem.replace("_", " "),
                artist=artist,
                file_path=str(file_path),
                category_id=category_id,
            )
            db.add(track)
            db.commit()
            db.refresh(track)
            track_id = track.id
            track_title = track.title
        finally:
            db.close()

        return {
            "status": "completed",
            "track_id": track_id,
            "title": track_title,
            "file_path": str(file_path),
        }

    finally:
        if vpn_proc:
            _stop_vpn()
