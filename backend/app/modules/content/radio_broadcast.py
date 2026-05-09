from __future__ import annotations

import os
import shlex
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.modules.content.models import RadioContent

HLS_ROOT = Path("/var/www/vod-manager/shared/hls")


def _get_radio_stream_dir(channel_id: int) -> Path:
    return HLS_ROOT / f"radio_{channel_id}"


def _build_radio_ffmpeg_cmd(channel: RadioContent, stream_dir: str) -> list[str]:
    """Build the FFmpeg command for a radio channel broadcast.

    Three scenarios based on channel.visual_type:
      - 'video'  : loop a video file as visual, stream_url as audio
      - 'image'  : loop a still image as visual, stream_url as audio
      - anything else ('none' / None): audio-only HLS from stream_url
    """
    visual_type = (channel.visual_type or "none").lower()
    visual_url = channel.visual_url or ""
    stream_url = channel.stream_url or ""

    hls_params = [
        "-f", "hls",
        "-hls_time", "6",
        "-hls_list_size", "10",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", f"{stream_dir}/seg_%05d.ts",
        f"{stream_dir}/stream.m3u8",
    ]

    # Common audio output params shared by all modes
    audio_out = [
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "2",
        "-af", "aresample=async=1000",
    ]

    if visual_type == "video" and visual_url:
        return [
            "ffmpeg", "-y",
            "-fflags", "+genpts",
            "-re", "-stream_loop", "-1",
            "-i", visual_url,
            "-thread_queue_size", "512",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            "-analyzeduration", "2000000", "-probesize", "1000000",
            "-i", stream_url,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-tune", "stillimage",
            "-threads", "1",
            "-avoid_negative_ts", "make_zero",
        ] + audio_out + hls_params

    if visual_type == "image" and visual_url:
        return [
            "ffmpeg", "-y",
            "-fflags", "+genpts",
            "-loop", "1",
            "-i", visual_url,
            "-thread_queue_size", "512",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            "-analyzeduration", "2000000", "-probesize", "1000000",
            "-i", stream_url,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-tune", "stillimage",
            "-threads", "1",
            "-avoid_negative_ts", "make_zero",
            "-shortest",
        ] + audio_out + hls_params

    # audio-only (visual_type == 'none' or no visual_url)
    return [
        "ffmpeg", "-y",
        "-fflags", "+genpts",
        "-thread_queue_size", "512",
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-analyzeduration", "2000000", "-probesize", "1000000",
        "-i", stream_url,
        "-avoid_negative_ts", "make_zero",
        "-vn",
    ] + audio_out + hls_params


def _build_restart_script(ffmpeg_args: list[str], log_path: str) -> str:
    """Wrap FFmpeg in a bash loop that restarts it on exit.

    Uses shlex.quote() to safely handle URLs/paths with special shell chars
    (semicolons, spaces, question marks, ampersands, etc.).
    """
    ffmpeg_cmd = " ".join(shlex.quote(a) for a in ffmpeg_args)
    log_q = shlex.quote(log_path)
    return (
        f'while true; do '
        f'{ffmpeg_cmd} >> {log_q} 2>&1; '
        f'echo "[wrapper] FFmpeg exited, restarting in 2s..." >> {log_q} 2>&1; '
        f'sleep 2; '
        f'done'
    )


def _load_radio_channel(db: Session, channel_id: int) -> RadioContent:
    ch = (
        db.query(RadioContent)
        .options(joinedload(RadioContent.category), joinedload(RadioContent.server))
        .filter(RadioContent.id == channel_id)
        .first()
    )
    if ch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Radyo kanali bulunamadi",
        )
    return ch


def _kill_existing_ffmpeg(channel_id: int) -> None:
    """Kill any stale bash wrapper + FFmpeg for this channel (pattern-based)."""
    pattern = f"radio_{channel_id}"
    try:
        subprocess.run(
            ["pkill", "-TERM", "-f", pattern],
            capture_output=True,
        )
    except Exception:
        pass


def start_radio_channel(db: Session, channel_id: int) -> dict[str, Any]:
    ch = _load_radio_channel(db, channel_id)

    if not ch.stream_url or not ch.stream_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stream URL tanimlanmamis — radyo kanali baslatmak icin stream_url gereklidir",
        )

    # Kill any orphaned process before starting fresh
    _kill_existing_ffmpeg(channel_id)

    if ch.is_active:
        ch.is_active = False
        ch.ffmpeg_pid = None
        db.add(ch)
        db.commit()

    stream_dir = str(_get_radio_stream_dir(channel_id))
    os.makedirs(stream_dir, exist_ok=True)

    args = _build_radio_ffmpeg_cmd(ch, stream_dir)
    log_path = f"{stream_dir}/ffmpeg.log"
    restart_script = _build_restart_script(args, log_path)

    proc = subprocess.Popen(
        ["bash", "-c", restart_script],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    pid = proc.pid

    hls_url = f"http://{settings.MAIN_SERVER_IP}/hls/radio_{channel_id}/stream.m3u8"

    ch.is_active = True
    ch.ffmpeg_pid = pid
    ch.started_at = datetime.now(timezone.utc)
    db.add(ch)
    db.commit()

    return {"ok": True, "pid": pid, "hls_url": hls_url}


def stop_radio_channel(db: Session, channel_id: int) -> dict[str, Any]:
    ch = _load_radio_channel(db, channel_id)

    if not ch.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Radyo kanali zaten durdurulmus",
        )

    pid = ch.ffmpeg_pid
    if pid:
        killed = False
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            killed = True
        except (ProcessLookupError, PermissionError, OSError):
            pass
        if not killed:
            try:
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                pass
        _kill_existing_ffmpeg(channel_id)

    ch.is_active = False
    ch.ffmpeg_pid = None
    ch.started_at = None
    db.add(ch)
    db.commit()

    return {"ok": True}


def restart_radio_channel(db: Session, channel_id: int) -> dict[str, Any]:
    ch = _load_radio_channel(db, channel_id)

    # Stop if running
    if ch.is_active:
        pid = ch.ffmpeg_pid
        if pid:
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                pass
            try:
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                pass
        _kill_existing_ffmpeg(channel_id)
        ch.is_active = False
        ch.ffmpeg_pid = None
        ch.started_at = None
        db.add(ch)
        db.commit()

    return start_radio_channel(db, channel_id)
