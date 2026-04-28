from __future__ import annotations

import os
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import paramiko
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.security import decrypt_secret
from app.modules.playlist.models import Playlist, PlaylistItem
from app.modules.servers.models import Server
from app.core.config import settings

HLS_ROOT = Path("/var/www/vod-manager/shared/hls")
TRANSCODE_LOCAL_PATH = "/var/www/vod-manager/shared/transcode"


def _transcode_base_url() -> str:
    return f"http://{settings.MAIN_SERVER_IP}/transcode"


def _get_stream_dir(playlist_id: int) -> Path:
    return HLS_ROOT / str(playlist_id)


def _build_concat_content(items: list[PlaylistItem]) -> str:
    """Build concat file with local file paths (for main server)."""
    lines = []
    for item in sorted(items, key=lambda i: i.position):
        path = item.file_path.replace("'", r"'\''")
        lines.append(f"file '{path}'")
    return "\n".join(lines) + "\n"


def _build_concat_content_http(items: list[PlaylistItem]) -> str:
    """Build concat file with HTTP URLs (for remote/LB servers).

    Converts local paths like /var/www/vod-manager/shared/transcode/X/file.mp4
    to http://62.210.92.252/transcode/X/file.mp4 so FFmpeg on the LB server
    can stream video directly from the main server over HTTP.
    """
    lines = []
    for item in sorted(items, key=lambda i: i.position):
        file_path = item.file_path
        if file_path.startswith(TRANSCODE_LOCAL_PATH):
            relative = file_path[len(TRANSCODE_LOCAL_PATH):]
            relative = relative.lstrip("/")
            url = f"{_transcode_base_url()}/{relative}"
        else:
            # Fallback: use as-is (may fail on remote, but better than nothing)
            url = file_path
        lines.append(f"file '{url}'")
    return "\n".join(lines) + "\n"


def _get_ffmpeg_args(playlist_id: int, concat_file: str, stream_dir: str, remote: bool = False) -> list[str]:
    args = [
        "ffmpeg", "-y",
        "-fflags", "+genpts",
        "-re",
    ]
    if remote:
        # Allow HTTP URLs inside the concat file when running on a remote server
        args += ["-protocol_whitelist", "file,http,https,tcp,tls,crypto"]
    args += [
        "-f", "concat", "-safe", "0", "-stream_loop", "-1",
        "-i", concat_file,
        # Sync & timestamp params (critical for seamless concat transitions)
        "-vsync", "cfr",
        "-r", "25",
        # Re-encode to normalize codec/fps/keyframe differences between videos
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-maxrate", "4000k",
        "-bufsize", "8000k",
        "-g", "50",
        "-keyint_min", "50",
        "-bf", "3",
        "-b_strategy", "2",
        "-sc_threshold", "0",
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-map", "0:v:0",
        "-map", "0:a:0",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "48000",
        "-ac", "2",
        "-async", "1",
        "-avoid_negative_ts", "make_zero",
        "-thread_queue_size", "512",
        "-f", "hls",
        "-hls_time", "4",
        "-hls_list_size", "30",
        "-hls_flags", "delete_segments+append_list+omit_endlist",
        "-hls_segment_filename", f"{stream_dir}/seg_%05d.ts",
        f"{stream_dir}/stream.m3u8",
    ]
    return args


def _build_restart_script(ffmpeg_args: list[str], log_path: str) -> str:
    """Build a bash while-loop that restarts FFmpeg on exit (infinite loop)."""
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


def _load_playlist(db: Session, playlist_id: int) -> Playlist:
    pl = (
        db.query(Playlist)
        .options(joinedload(Playlist.items), joinedload(Playlist.server))
        .filter(Playlist.id == playlist_id)
        .first()
    )
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
    return pl


def _get_server(db: Session, server_id: int) -> Server:
    srv = db.query(Server).filter(Server.id == server_id).first()
    if srv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sunucu bulunamadi")
    return srv


def _is_local_process_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but we don't own it (e.g. www-data checking root process)
        return os.path.exists(f"/proc/{pid}")


def _ssh_connect(srv: Server) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=srv.ip_address,
        port=srv.ssh_port,
        username=srv.ssh_username,
        password=decrypt_secret(srv.ssh_password),
        timeout=10,
    )
    return client


def _ssh_exec(client: paramiko.SSHClient, command: str) -> str:
    _, stdout, _ = client.exec_command(command, timeout=30)
    stdout.channel.recv_exit_status()
    return stdout.read().decode(errors="replace").strip()


def _kill_existing_ffmpeg(playlist_id: int, server_id: int | None = None, db: Session | None = None) -> None:
    """Kill any existing bash wrapper + FFmpeg processes for this playlist.

    Uses pkill -f with the concat file pattern which is unique per playlist.
    Handles errors gracefully — the process may not exist yet.
    """
    pattern = f"playlist_{playlist_id}_concat"
    if server_id is None:
        # Local kill
        try:
            subprocess.run(
                ["pkill", "-TERM", "-f", pattern],
                capture_output=True,
            )
        except Exception:
            pass
    else:
        # Remote kill via SSH
        if db is None:
            return
        try:
            srv = _get_server(db, server_id)
            client = _ssh_connect(srv)
            try:
                _ssh_exec(client, f"pkill -TERM -f '{pattern}' 2>/dev/null || true")
            finally:
                client.close()
        except Exception:
            pass


def start_broadcast(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_playlist(db, playlist_id)

    # Kill any orphan processes for this playlist before starting fresh
    _kill_existing_ffmpeg(playlist_id, server_id=pl.server_id, db=db)

    if pl.status == "playing":
        # Allow restart: clear the stale state instead of raising
        pl.status = "stopped"
        pl.ffmpeg_pid = None
        db.add(pl)
        db.commit()

    items = sorted(pl.items, key=lambda i: i.position)
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Playlist bos — once video ekleyin")

    concat_file = f"/tmp/playlist_{playlist_id}_concat.txt"
    concat_content = _build_concat_content(items)
    stream_dir = str(_get_stream_dir(playlist_id))

    if pl.server_id is None:
        # Local execution on main server
        os.makedirs(stream_dir, exist_ok=True)
        with open(concat_file, "w") as f:
            f.write(concat_content)

        args = _get_ffmpeg_args(playlist_id, concat_file, stream_dir)
        log_path = f"{stream_dir}/ffmpeg.log"
        restart_script = _build_restart_script(args, log_path)
        proc = subprocess.Popen(
            ["bash", "-c", restart_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        pid = proc.pid
        # Local HLS served directly via nginx /hls/ on port 8080
        stream_url = None
    else:
        # Remote SSH execution (LB server)
        # Use HTTP URLs in concat so FFmpeg on the remote server streams video
        # directly from the main server — no file copy needed.
        concat_content = _build_concat_content_http(items)
        srv = _get_server(db, pl.server_id)
        client = _ssh_connect(srv)
        try:
            _ssh_exec(client, f"mkdir -p {stream_dir}")
            sftp = client.open_sftp()
            with sftp.file(concat_file, "w") as f:
                f.write(concat_content)
            sftp.close()
            args = _get_ffmpeg_args(playlist_id, concat_file, stream_dir, remote=True)
            log_path = f"{stream_dir}/ffmpeg.log"
            restart_script = _build_restart_script(args, log_path)
            remote_cmd = f"nohup bash -c {repr(restart_script)} > {log_path} 2>&1 & echo $!"
            pid_str = _ssh_exec(client, remote_cmd)
            pid = int(pid_str.strip())
            stream_url = f"http://{srv.ip_address}/hls/{playlist_id}/stream.m3u8"
        finally:
            client.close()

    pl.status = "playing"
    pl.ffmpeg_pid = pid
    pl.stream_url = stream_url
    pl.started_at = datetime.now(timezone.utc)
    pl.current_item_index = 0
    db.add(pl)
    db.commit()

    return {"ok": True, "pid": pid, "stream_url": stream_url}


def stop_broadcast(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_playlist(db, playlist_id)
    if pl.status != "playing":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yayin zaten durmus")

    pid = pl.ffmpeg_pid
    if pid:
        if pl.server_id is None:
            killed = False
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
                killed = True
            except (ProcessLookupError, PermissionError):
                pass
            if not killed:
                try:
                    os.kill(pid, signal.SIGTERM)
                    killed = True
                except (ProcessLookupError, PermissionError):
                    pass
            if not killed:
                # Last resort: use pkill via subprocess (works across user boundaries)
                subprocess.run(
                    ["pkill", "-TERM", "-s", str(pid)],
                    capture_output=True,
                )
                subprocess.run(
                    ["kill", str(pid)],
                    capture_output=True,
                )
            # Safety net: pattern-based kill to catch any orphan bash wrapper + ffmpeg
            _kill_existing_ffmpeg(playlist_id, server_id=None)
        else:
            srv = _get_server(db, pl.server_id)
            client = _ssh_connect(srv)
            try:
                _ssh_exec(client, f"kill {pid} 2>/dev/null || true")
            finally:
                client.close()
            # Safety net for remote: pattern-based kill via SSH
            _kill_existing_ffmpeg(playlist_id, server_id=pl.server_id, db=db)

    pl.status = "stopped"
    pl.ffmpeg_pid = None
    pl.started_at = None
    db.add(pl)
    db.commit()

    return {"ok": True}


def get_broadcast_status(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_playlist(db, playlist_id)
    items = sorted(pl.items, key=lambda i: i.position)
    is_running = False
    current_title: str | None = None
    elapsed_seconds = 0

    if pl.status == "playing" and pl.ffmpeg_pid:
        pid = pl.ffmpeg_pid
        if pl.server_id is None:
            is_running = _is_local_process_running(pid)
        else:
            try:
                srv = _get_server(db, pl.server_id)
                client = _ssh_connect(srv)
                try:
                    out = _ssh_exec(client, f"kill -0 {pid} 2>/dev/null && echo running || echo stopped")
                    is_running = out.strip() == "running"
                finally:
                    client.close()
            except Exception:
                is_running = False

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
        total_dur = pl.total_duration_seconds or 1
        loop_pos = elapsed_seconds % total_dur if total_dur > 0 else 0
        cumulative = 0
        current_idx = 0
        for i, item in enumerate(items):
            cumulative += item.duration_seconds
            if loop_pos < cumulative:
                current_idx = i
                current_title = item.title
                break
        pl.current_item_index = current_idx
        db.add(pl)
        db.commit()

    return {
        "playlist_id": playlist_id,
        "status": pl.status,
        "ffmpeg_pid": pl.ffmpeg_pid,
        "stream_url": pl.stream_url,
        "started_at": pl.started_at,
        "elapsed_seconds": elapsed_seconds,
        "current_item_index": pl.current_item_index,
        "current_title": current_title,
        "is_running": is_running,
    }


def _xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _compute_loop_start(pl: "Playlist", items: list["PlaylistItem"]) -> "datetime":
    from datetime import timedelta

    if pl.started_at:
        started = pl.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed = int((now - started).total_seconds())
        total_dur = pl.total_duration_seconds or sum(i.duration_seconds for i in items)
        loop_pos = elapsed % total_dur if total_dur > 0 else 0
        return now - timedelta(seconds=loop_pos)
    return datetime.now(timezone.utc)


def generate_epg_xml(db: Session, playlist_id: int) -> str:
    """Generate XMLTV-format EPG for 24 hours with playlist loop."""
    from datetime import timedelta

    pl = _load_playlist(db, playlist_id)
    items = sorted(pl.items, key=lambda i: i.position)
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Playlist bos")

    loop_start = _compute_loop_start(pl, items)
    end_time = loop_start + timedelta(hours=24)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<tv generator-info-name="VOD Manager">')
    lines.append(f'  <channel id="playlist_{playlist_id}">')
    lines.append(f'    <display-name>{_xml_escape(pl.name)}</display-name>')
    lines.append(f'  </channel>')

    current_time = loop_start
    item_idx = 0

    while current_time < end_time:
        item = items[item_idx % len(items)]
        duration = item.duration_seconds or 60
        prog_end = min(current_time + timedelta(seconds=duration), end_time)

        start_str = current_time.strftime("%Y%m%d%H%M%S") + " +0000"
        stop_str = prog_end.strftime("%Y%m%d%H%M%S") + " +0000"

        title = item.tmdb_title or item.title
        desc = item.tmdb_overview or ""
        poster = item.tmdb_poster_url or ""

        lines.append(f'  <programme start="{start_str}" stop="{stop_str}" channel="playlist_{playlist_id}">')
        lines.append(f"    <title>{_xml_escape(title)}</title>")
        if desc:
            lines.append(f"    <desc>{_xml_escape(desc)}</desc>")
        if poster:
            lines.append(f'    <icon src="{_xml_escape(poster)}"/>')
        lines.append("    <category>Movie</category>")
        lines.append("  </programme>")

        current_time = prog_end
        item_idx += 1

    lines.append("</tv>")
    return "\n".join(lines)


def generate_combined_epg_xml(db: Session) -> str:
    """Generate combined XMLTV EPG for all non-empty playlists (24h each)."""
    from datetime import timedelta

    playlists = (
        db.query(Playlist)
        .options(joinedload(Playlist.items))
        .all()
    )

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<tv generator-info-name="VOD Manager">')

    # First pass: channel definitions (skip empty playlists)
    active = []
    for pl in playlists:
        items = sorted(pl.items, key=lambda i: i.position)
        if not items:
            continue
        active.append((pl, items))
        lines.append(f'  <channel id="playlist_{pl.id}">')
        lines.append(f'    <display-name lang="tr">{_xml_escape(pl.name)}</display-name>')
        lines.append(f'  </channel>')

    # Second pass: programme entries
    for pl, items in active:
        loop_start = _compute_loop_start(pl, items)
        end_time = loop_start + timedelta(hours=24)
        current_time = loop_start
        item_idx = 0

        while current_time < end_time:
            item = items[item_idx % len(items)]
            duration = item.duration_seconds or 60
            prog_end = min(current_time + timedelta(seconds=duration), end_time)

            start_str = current_time.strftime("%Y%m%d%H%M%S") + " +0000"
            stop_str = prog_end.strftime("%Y%m%d%H%M%S") + " +0000"

            title = item.tmdb_title or item.title
            desc = item.tmdb_overview or ""
            poster = item.tmdb_poster_url or ""

            lines.append(f'  <programme start="{start_str}" stop="{stop_str}" channel="playlist_{pl.id}">')
            lines.append(f'    <title lang="tr">{_xml_escape(title)}</title>')
            if desc:
                lines.append(f'    <desc lang="tr">{_xml_escape(desc)}</desc>')
            if poster:
                lines.append(f'    <icon src="{_xml_escape(poster)}"/>')
            lines.append('    <category lang="tr">Film</category>')
            lines.append("  </programme>")

            current_time = prog_end
            item_idx += 1

    lines.append("</tv>")
    return "\n".join(lines)


def generate_epg_programs(db: Session, playlist_id: int) -> list[dict[str, Any]]:
    """Return EPG programs as JSON list for frontend consumption."""
    from datetime import timedelta

    pl = _load_playlist(db, playlist_id)
    items = sorted(pl.items, key=lambda i: i.position)
    if not items:
        return []

    loop_start = _compute_loop_start(pl, items)
    end_time = loop_start + timedelta(hours=24)
    now = datetime.now(timezone.utc)

    programs = []
    current_time = loop_start
    item_idx = 0

    while current_time < end_time:
        item = items[item_idx % len(items)]
        duration = item.duration_seconds or 60
        prog_end = min(current_time + timedelta(seconds=duration), end_time)

        programs.append({
            "start": current_time.isoformat(),
            "stop": prog_end.isoformat(),
            "title": item.tmdb_title or item.title,
            "desc": item.tmdb_overview or "",
            "poster": item.tmdb_poster_url or "",
            "duration_seconds": duration,
            "is_current": current_time <= now < prog_end,
        })

        current_time = prog_end
        item_idx += 1

    return programs


def update_broadcast_list(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _load_playlist(db, playlist_id)
    items = sorted(pl.items, key=lambda i: i.position)
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Playlist bos")

    concat_file = f"/tmp/playlist_{playlist_id}_concat.txt"
    concat_content = _build_concat_content(items)

    if pl.server_id is None:
        with open(concat_file, "w") as f:
            f.write(concat_content)
    else:
        # Remote server: use HTTP URLs so FFmpeg can fetch from main server
        concat_content = _build_concat_content_http(items)
        srv = _get_server(db, pl.server_id)
        client = _ssh_connect(srv)
        try:
            sftp = client.open_sftp()
            with sftp.file(concat_file, "w") as f:
                f.write(concat_content)
            sftp.close()
        finally:
            client.close()

    if pl.status == "playing" and pl.ffmpeg_pid:
        stop_broadcast(db, playlist_id)
        return start_broadcast(db, playlist_id)

    return {"ok": True, "message": "Liste guncellendi"}
