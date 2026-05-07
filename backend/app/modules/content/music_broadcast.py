from __future__ import annotations

import os
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.modules.content.models import MusicPlaylist, MusicPlaylistItem, MusicTrack

HLS_ROOT = Path("/var/www/vod-manager/shared/hls")


def _get_music_stream_dir(playlist_id: int) -> Path:
    return HLS_ROOT / f"music_{playlist_id}"


def _build_music_concat(items: list[MusicPlaylistItem]) -> str:
    """Build concat file content for music playlist items.

    Each item references the linked MusicTrack. Prefer file_path; fall back
    to stream_url. Items that have neither are skipped.
    """
    lines = []
    for item in sorted(items, key=lambda i: i.position):
        track: MusicTrack | None = item.track
        if track is None:
            continue
        if track.file_path and track.file_path.strip():
            path = track.file_path.replace("'", r"'\''")
            lines.append(f"file '{path}'")
        elif track.stream_url and track.stream_url.strip():
            url = track.stream_url.strip()
            lines.append(f"file '{url}'")
    return "\n".join(lines) + "\n"


def _build_ffmpeg_cmd(
    playlist: MusicPlaylist,
    concat_path: str,
    stream_dir: str,
) -> list[str]:
    """Build the FFmpeg command list for a music broadcast.

    Three scenarios based on playlist.visual_type:
      - 'video'  : loop a video file as visual, concat audio
      - 'image'  : loop a still image as visual, concat audio
      - anything else ('none' / None): audio-only HLS stream
    """
    visual_type = (playlist.visual_type or "none").lower()
    visual_url = playlist.visual_url or ""

    hls_params = [
        "-f", "hls",
        "-hls_time", "6",
        "-hls_list_size", "10",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", f"{stream_dir}/seg_%05d.ts",
        f"{stream_dir}/stream.m3u8",
    ]

    if visual_type == "video" and visual_url:
        return [
            "ffmpeg", "-y",
            "-re", "-stream_loop", "-1",
            "-i", visual_url,
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
            "-f", "concat", "-safe", "0", "-stream_loop", "-1",
            "-i", concat_path,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-tune", "stillimage",
            "-threads", "1",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-shortest",
        ] + hls_params

    if visual_type == "image" and visual_url:
        return [
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", visual_url,
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
            "-f", "concat", "-safe", "0", "-stream_loop", "-1",
            "-i", concat_path,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-tune", "stillimage",
            "-threads", "1",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            "-shortest",
        ] + hls_params

    # audio-only (visual_type == 'none' or no visual_url)
    return [
        "ffmpeg", "-y",
        "-re",
        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
        "-f", "concat", "-safe", "0", "-stream_loop", "-1",
        "-i", concat_path,
        "-vn",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "2",
    ] + hls_params


def _build_restart_script(ffmpeg_args: list[str], log_path: str) -> str:
    """Wrap FFmpeg in a bash loop that restarts it on exit."""
    cmd_parts = []
    for a in ffmpeg_args:
        if " " in a or "'" in a or "(" in a or ")" in a:
            cmd_parts.append(f'"{a}"')
        else:
            cmd_parts.append(a)
    ffmpeg_cmd = " ".join(cmd_parts)
    return (
        f'while true; do '
        f'{ffmpeg_cmd} >> "{log_path}" 2>&1; '
        f'echo "[wrapper] FFmpeg exited, restarting in 2s..." >> "{log_path}" 2>&1; '
        f'sleep 2; '
        f'done'
    )


def _load_music_playlist(db: Session, playlist_id: int) -> MusicPlaylist:
    pl = (
        db.query(MusicPlaylist)
        .options(
            joinedload(MusicPlaylist.items).joinedload(MusicPlaylistItem.track)
        )
        .filter(MusicPlaylist.id == playlist_id)
        .first()
    )
    if pl is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Muzik playlist bulunamadi",
        )
    return pl


def _is_local_process_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return os.path.exists(f"/proc/{pid}")


def _kill_existing_ffmpeg(playlist_id: int) -> None:
    """Kill any stale bash wrapper + FFmpeg for this playlist (pattern-based)."""
    pattern = f"music_{playlist_id}_concat"
    try:
        subprocess.run(
            ["pkill", "-TERM", "-f", pattern],
            capture_output=True,
        )
    except Exception:
        pass


def start_music_playlist(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_music_playlist(db, playlist_id)

    # Kill any orphaned process before starting fresh
    _kill_existing_ffmpeg(playlist_id)

    if pl.status == "playing":
        pl.status = "stopped"
        pl.ffmpeg_pid = None
        db.add(pl)
        db.commit()

    items = sorted(pl.items, key=lambda i: i.position)
    valid_items = [
        item for item in items
        if item.track and (
            (item.track.file_path and item.track.file_path.strip())
            or (item.track.stream_url and item.track.stream_url.strip())
        )
    ]
    if not valid_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Playlist bos — once muzik track ekleyin (file_path veya stream_url zorunlu)",
        )

    stream_dir = str(_get_music_stream_dir(playlist_id))
    concat_file = f"/tmp/music_{playlist_id}_concat.txt"

    os.makedirs(stream_dir, exist_ok=True)

    concat_content = _build_music_concat(items)
    with open(concat_file, "w", encoding="utf-8") as f:
        f.write(concat_content)

    args = _build_ffmpeg_cmd(pl, concat_file, stream_dir)
    log_path = f"{stream_dir}/ffmpeg.log"
    restart_script = _build_restart_script(args, log_path)

    proc = subprocess.Popen(
        ["bash", "-c", restart_script],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    pid = proc.pid

    # stream_url: local HLS served by nginx /hls/
    stream_url = f"http://{settings.MAIN_SERVER_IP}/hls/music_{playlist_id}/stream.m3u8"

    pl.status = "playing"
    pl.ffmpeg_pid = pid
    pl.stream_url = stream_url
    pl.started_at = datetime.now(timezone.utc)
    pl.is_active = True
    db.add(pl)
    db.commit()

    return {"ok": True, "pid": pid, "stream_url": stream_url}


def stop_music_playlist(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_music_playlist(db, playlist_id)

    if pl.status != "playing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Muzik playlist zaten durmus",
        )

    pid = pl.ffmpeg_pid
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
        # Pattern-based safety kill
        _kill_existing_ffmpeg(playlist_id)

    pl.status = "stopped"
    pl.ffmpeg_pid = None
    pl.started_at = None
    pl.is_active = False
    db.add(pl)
    db.commit()

    return {"ok": True}


def get_music_playlist_status(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_music_playlist(db, playlist_id)
    items = sorted(pl.items, key=lambda i: i.position)
    is_running = False
    current_title: str | None = None
    elapsed_seconds = 0

    if pl.status == "playing" and pl.ffmpeg_pid:
        is_running = _is_local_process_running(pl.ffmpeg_pid)
        if not is_running:
            pl.status = "stopped"
            pl.ffmpeg_pid = None
            db.add(pl)
            db.commit()

    if pl.status == "playing" and pl.started_at and items:
        now = datetime.now(timezone.utc)
        started = pl.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed_seconds = int((now - started).total_seconds())

        total_dur = sum(
            (item.track.duration_seconds or 0) for item in items if item.track
        )
        if total_dur > 0:
            loop_pos = elapsed_seconds % total_dur
            cumulative = 0
            for item in items:
                track_dur = (item.track.duration_seconds or 0) if item.track else 0
                cumulative += track_dur
                if loop_pos < cumulative:
                    current_title = item.track.title if item.track else None
                    break

    return {
        "playlist_id": playlist_id,
        "name": pl.name,
        "status": pl.status,
        "ffmpeg_pid": pl.ffmpeg_pid,
        "stream_url": pl.stream_url,
        "started_at": pl.started_at,
        "elapsed_seconds": elapsed_seconds,
        "current_title": current_title,
        "is_running": is_running,
        "visual_type": pl.visual_type,
        "item_count": len(items),
    }
