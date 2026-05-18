"""Info Screen HLS Broadcast — Pillow görseli + FFmpeg HLS stream.

Mimari:
  - generate_info_screen_image(db) → /tmp/info_screen.png
  - FFmpeg: image loop → HLS  → /var/www/vod-manager/shared/hls/info_screen/stream.m3u8
  - Her 30 saniyede bir görsel yenilenir (thread loop)
  - Durum /tmp/info_screen_state.json'da tutulur (PID + started_at)

API çağrısı:
  start_info_screen_stream(db) → {"ok": True, "stream_url": "..."}
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
DEFAULT_REFRESH_INTERVAL = 30  # saniye (template yoksa fallback)

# Thread referansı
_refresh_thread: threading.Thread | None = None
_stop_event = threading.Event()


# ── State helpers ──────────────────────────────────────────────────────────────

def _write_state(pid: int | None, running: bool) -> None:
    state = {
        "pid": pid,
        "running": running,
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
        return {"pid": None, "running": False, "started_at": None, "stream_url": None}


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


# ── FFmpeg helpers ─────────────────────────────────────────────────────────────

def _build_ffmpeg_args() -> list[str]:
    stream_dir = str(HLS_DIR)
    return [
        "ffmpeg", "-y",
        "-f", "image2",           # image2 demuxer: her frame'de dosyayı yeniden okur
        "-stream_loop", "-1",     # sonsuz loop
        "-framerate", "1/5",      # 5 saniyede 1 frame (0.2 fps) — CPU dostu
        "-i", IMAGE_PATH,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "stillimage",
        "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-r", "1/5",              # output 0.2 fps
        "-g", "1",
        "-threads", "1",
        "-an",
        "-f", "hls",
        "-hls_time", "10",        # 10 sn segment (daha az segment, daha az I/O)
        "-hls_list_size", "3",    # sadece son 3 segment
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


def _start_ffmpeg() -> int:
    """FFmpeg'i başlatır, PID döndürür."""
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


# ── Refresh thread ─────────────────────────────────────────────────────────────

def _refresh_loop(db_factory, initial_pid: int) -> None:
    """Şablonun refresh_interval değeri kadar saniyede bir görsel yeniler.

    image2 demuxer kullanıldığı için FFmpeg yeni görseli otomatik okur;
    restart gerekmez.
    """
    from app.modules.playlist.models import InfoScreenTemplate

    interval = DEFAULT_REFRESH_INTERVAL
    # İlk interval'ı veritabanından çek
    try:
        db: Session = db_factory()
        try:
            tmpl = (
                db.query(InfoScreenTemplate)
                .filter(InfoScreenTemplate.is_default == True)
                .first()
            )
            if tmpl is None:
                tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()
            if tmpl and tmpl.refresh_interval:
                interval = max(10, min(300, int(tmpl.refresh_interval)))
        finally:
            db.close()
    except Exception:
        pass

    while not _stop_event.is_set():
        _stop_event.wait(interval)
        if _stop_event.is_set():
            break
        # Her döngüde interval'ı güncelle (kullanıcı değiştirmiş olabilir)
        try:
            db: Session = db_factory()
            try:
                tmpl = (
                    db.query(InfoScreenTemplate)
                    .filter(InfoScreenTemplate.is_default == True)
                    .first()
                )
                if tmpl is None:
                    tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()
                if tmpl and tmpl.refresh_interval:
                    interval = max(10, min(300, int(tmpl.refresh_interval)))
            finally:
                db.close()
        except Exception:
            pass
        # Sadece yeni görsel oluştur — FFmpeg image2 demuxer ile otomatik okur
        try:
            db: Session = db_factory()
            try:
                from app.modules.playlist.info_screen_generator import generate_info_screen_image
                generate_info_screen_image(db)
            finally:
                db.close()
        except Exception:
            pass


# ── Public API ─────────────────────────────────────────────────────────────────

def start_info_screen_stream(db: Session) -> dict[str, Any]:
    global _refresh_thread, _stop_event

    # Önceki stream'i durdur
    _kill_existing()

    # İlk görseli oluştur
    from app.modules.playlist.info_screen_generator import generate_info_screen_image
    generate_info_screen_image(db)

    # FFmpeg başlat
    pid = _start_ffmpeg()
    _write_state(pid, True)

    # Refresh thread'i başlat
    _stop_event.clear()

    # db_factory: yeni session oluşturmak için
    from app.core.database import SessionLocal
    def _db_factory():
        return SessionLocal()

    _refresh_thread = threading.Thread(
        target=_refresh_loop,
        args=(_db_factory, pid),
        daemon=True,
        name="info_screen_refresh",
    )
    _refresh_thread.start()

    return {"ok": True, "pid": pid, "stream_url": STREAM_URL}


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
    if pid:
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
    running = bool(state.get("running")) and _is_process_running(pid)

    if not running and state.get("running"):
        # Tutarsız durum — state'i güncelle
        _write_state(None, False)

    return {
        "running": running,
        "pid": pid if running else None,
        "stream_url": STREAM_URL if running else None,
        "started_at": state.get("started_at") if running else None,
    }
