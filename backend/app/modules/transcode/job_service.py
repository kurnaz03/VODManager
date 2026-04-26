"""
Transcode job service - FFmpeg command building, queue management, progress tracking.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import paramiko
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal
from app.modules.content.models import MovieContent, MovieCategory
from app.modules.servers.models import Server
from app.modules.transcode.models import TranscodeJob, TranscodeProfile
from app.modules.transcode.job_schemas import TranscodeJobCreate, TranscodeJobUpdate

TRANSCODE_BASE_DIR = Path("/var/www/vod-manager/shared/transcode")
PREVIEW_DIR = Path("/tmp")

# ----- Helpers ----------------------------------------------------------------

def _safe_name(name: str) -> str:
    """Convert profile name to filesystem-safe directory name."""
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_") or "default"


def _get_output_path(profile_name: str, source_file_path: str, unique_number: int) -> str:
    safe_profile = _safe_name(profile_name)
    output_dir = TRANSCODE_BASE_DIR / safe_profile
    output_dir.mkdir(parents=True, exist_ok=True)
    src_stem = Path(source_file_path).stem
    # Format: {unique_number:05d}_{src_stem}.mp4 - unique_number always first for uniqueness
    filename = f"{unique_number:05d}_{src_stem}.mp4"
    return str(output_dir / filename)


def _get_video_duration(file_path: str) -> float | None:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", file_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception:
        return None


# ----- Filter builders -------------------------------------------------------

_TEXT_POS_MAP = {
    # (x_expr, y_expr, konum_tipi) - konum_tipi: "top" veya "bottom"
    "top-left":     ("10",         "10",        "top"),
    "top-right":    ("w-tw-10",    "10",        "top"),
    "bottom-left":  ("10",         "h-th-10",   "bottom"),
    "bottom-right": ("w-tw-10",    "h-th-10",   "bottom"),
    "center":       ("(w-tw)/2",   "(h-th)/2",  "mid"),
    "center-bottom":("(w-tw)/2",   "h-th-10",   "bottom"),
    "center-top":   ("(w-tw)/2",   "10",        "top"),
}

_COUNTDOWN_POS_MAP = {
    "top-left": ("10", "50"),
    "top-right": ("w-tw-10", "50"),
    "bottom-left": ("10", "h-th-60"),
    "bottom-right": ("w-tw-10", "h-th-60"),
}


def _drawtext_filter(
    text: str,
    position: str,
    size: int,
    color: str,
    bg_enabled: bool,
    bg_color: str,
    padding_top: int = 0,
    padding_bottom: int = 0,
    fade_enabled: bool = False,
    fade_interval: int = 600,
    fade_duration: int = 20,
    fade_in_time: int = 3,
    fade_out_time: int = 3,
) -> str:
    """FFmpeg drawtext filtresi olusturur.

    Padding degerleri:
    - top pozisyonlar: y degerine padding_top eklenir
    - bottom pozisyonlar: y degerinden padding_bottom cikarilir

    Fade efekti:
    - Her fade_interval saniyede bir, fade_duration saniye boyunca yazi gizlenir
    - Kaybolurken fade_out_time saniyede soluklaşır (alpha 1->0)
    - Geri gelirken fade_in_time saniyede belirir (alpha 0->1)
    """
    escaped = text.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")
    hex_color = color.lstrip("#")
    pos_data = _TEXT_POS_MAP.get(position, ("w-tw-10", "h-th-10", "bottom"))
    x, y_base, pos_type = pos_data[0], pos_data[1], pos_data[2]

    # Padding'e gore y koordinatini ayarla
    if pos_type == "top" and padding_top > 0:
        y = f"{y_base}+{padding_top}"
    elif pos_type == "bottom" and padding_bottom > 0:
        y = f"{y_base}-{padding_bottom}"
    else:
        y = y_base

    dt = f"drawtext=text='{escaped}':fontsize={size}:fontcolor=0x{hex_color}FF:x={x}:y={y}"

    if bg_enabled:
        bg_hex = bg_color.lstrip("#")
        dt += f":box=1:boxcolor=0x{bg_hex}B3:boxborderw=5"

    # Fade in/out alpha expression ekle
    if fade_enabled:
        # Gorunur kalma suresi = toplam dongu - gizli kalma suresi
        visible_time = fade_interval - fade_duration
        # Negatif olmasin
        if visible_time < 1:
            visible_time = 1
        # FFmpeg alpha ifadesi:
        # mod(t, INTERVAL) < VISIBLE_TIME => gorunur (alpha=1)
        # VISIBLE_TIME <= mod(t, INTERVAL) < VISIBLE_TIME+FADE_OUT => kayboluyor (alpha azaliyor)
        # VISIBLE_TIME+FADE_OUT <= mod(t, INTERVAL) < INTERVAL-FADE_IN => tamamen gizli (alpha=0)
        # INTERVAL-FADE_IN <= mod(t, INTERVAL) => beliriyor (alpha artiyor)
        alpha_expr = (
            f"if(lt(mod(t\\,{fade_interval})\\,{visible_time})\\,"
            f"1\\,"
            f"if(lt(mod(t\\,{fade_interval})-{visible_time}\\,{fade_out_time})\\,"
            f"({fade_out_time}-(mod(t\\,{fade_interval})-{visible_time}))"
            f"/{fade_out_time}\\,"
            f"if(gt(mod(t\\,{fade_interval})\\,{fade_interval}-{fade_in_time})\\,"
            f"(mod(t\\,{fade_interval})-({fade_interval}-{fade_in_time}))"
            f"/{fade_in_time}\\,"
            f"0)))"
        )
        dt += f":alpha='{alpha_expr}'"

    return dt


def _countdown_filter(duration: float, position: str) -> str:
    """Generate HH:MM:SS countdown overlay filter."""
    dur_int = int(duration)
    x, y = _COUNTDOWN_POS_MAP.get(position, ("w-tw-10", "50"))
    # Build HH:MM:SS expression using FFmpeg's eif (evaluate as integer)
    rem = f"max(0\\,{dur_int}-t)"
    hh = f"%{{eif\\:floor({rem}/3600)\\:d\\:2}}"
    mm = f"%{{eif\\:floor(mod({rem}\\,3600)/60)\\:d\\:2}}"
    ss = f"%{{eif\\:floor(mod({rem}\\,60))\\:d\\:2}}"
    text = f"{hh}\\:{mm}\\:{ss}"
    return (
        f"drawtext=text='{text}':"
        f"fontsize=32:fontcolor=white:x={x}:y={y}:"
        f"box=1:boxcolor=black@0.7:boxborderw=5"
    )


# ----- FFmpeg command builder ------------------------------------------------

def build_ffmpeg_cmd(
    job: TranscodeJob,
    profile: TranscodeProfile,
    output_path: str,
    duration: float | None = None,
    preview: bool = False,
    source_override: str | None = None,
    logo_path_override: str | None = None,
) -> list[str]:
    cmd = ["ffmpeg", "-y", "-hide_banner"]

    source_path = source_override or job.source_file_path

    # fflags (before input)
    fflags = getattr(profile, "fflags_mode", None) or "+genpts"
    if fflags:
        cmd += ["-fflags", fflags]

    # Hardware acceleration
    hw = profile.hardware_accel or ""
    hwaccel_type = getattr(profile, "hwaccel_type", None) or ""
    if hw == "nvenc" or hwaccel_type == "cuda":
        cmd += ["-hwaccel", "cuda"]
    elif hw == "vaapi" or hwaccel_type == "vaapi":
        cmd += ["-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi", "-vaapi_device", "/dev/dri/renderD128"]
    elif hw == "qsv" or hwaccel_type == "qsv":
        cmd += ["-hwaccel", "qsv"]

    # thread_queue_size (before input)
    tqs = getattr(profile, "thread_queue_size", None)
    if tqs is not None:
        cmd += ["-thread_queue_size", str(tqs)]

    # Input
    cmd += ["-i", source_path]

    # Logo as second input
    effective_logo_path = logo_path_override or (str(profile.logo_path) if profile.logo_path else None)
    # When logo_path_override is given (remote transcode), the file already exists on the remote host —
    # skip the local os.path.exists() check which would always return False for remote paths.
    has_logo = bool(
        effective_logo_path and (
            logo_path_override is not None or os.path.exists(effective_logo_path)
        )
    )
    if has_logo:
        cmd += ["-i", effective_logo_path]

    # Preview limit
    if preview:
        cmd += ["-t", "10"]

    # ---- Build filters ----
    # ---- Audio map flags (determined before building filter/map lines) ----
    audio_map_val = getattr(profile, "audio_map", "first") or "first"
    if audio_map_val == "all":
        audio_map_args = ["-map", "0:a?"]
    elif audio_map_val == "custom":
        ch = getattr(profile, "audio_map_channel", None)
        idx = int(ch) if ch is not None else 0
        audio_map_args = ["-map", f"0:a:{idx}"]
    else:  # first
        audio_map_args = ["-map", "0:a:0?"]

    if has_logo:
        # Use -filter_complex for logo overlay
        parts: list[str] = []
        base = "[0:v]"

        if profile.deinterlace:
            deint_mode = getattr(profile, "deinterlace_mode", "yadif") or "yadif"
            parts.append(f"{base}{deint_mode}=0:-1:0[deint0]")
            base = "[deint0]"

        if profile.video_width or profile.video_height:
            w = profile.video_width or -2
            h = profile.video_height or -2
            alg = profile.scaling_algorithm or "lanczos"
            parts.append(f"{base}scale={w}:{h}:flags={alg}[scaled0]")
            base = "[scaled0]"

        # Logo scale & opacity
        logo_steps: list[str] = []
        logo_in = "[1:v]"
        if profile.logo_width and profile.logo_height:
            logo_steps.append(f"{logo_in}scale={profile.logo_width}:{profile.logo_height}[logoscaled]")
            logo_in = "[logoscaled]"
        opacity = profile.logo_opacity if profile.logo_opacity is not None else 1.0
        if opacity < 1.0:
            logo_steps.append(f"{logo_in}format=rgba,colorchannelmixer=aa={opacity:.2f}[logofinal]")
            logo_in = "[logofinal]"
        parts.extend(logo_steps)

        pos_map = {
            "top-left": "10:10",
            "top-right": "W-w-10:10",
            "bottom-left": "10:H-h-10",
            "bottom-right": "W-w-10:H-h-10",
            "center": "(W-w)/2:(H-h)/2",
        }
        pos = pos_map.get(profile.logo_position or "top-right", "W-w-10:10")
        parts.append(f"{base}{logo_in}overlay={pos}[overlaid]")
        base = "[overlaid]"

        # Yazi overlay - padding ve fade parametreleriyle
        if job.overlay_text:
            tf = _drawtext_filter(
                job.overlay_text, job.text_position, job.text_size,
                job.text_color, job.text_bg_enabled, job.text_bg_color,
                padding_top=getattr(job, "text_padding_top", 0) or 0,
                padding_bottom=getattr(job, "text_padding_bottom", 0) or 0,
                fade_enabled=getattr(job, "text_fade_enabled", False) or False,
                fade_interval=getattr(job, "text_fade_interval", 600) or 600,
                fade_duration=getattr(job, "text_fade_duration", 20) or 20,
                fade_in_time=getattr(job, "text_fade_in_time", 3) or 3,
                fade_out_time=getattr(job, "text_fade_out_time", 3) or 3,
            )
            parts.append(f"{base}{tf}[texted]")
            base = "[texted]"

        if job.countdown_enabled and duration:
            cf = _countdown_filter(duration, job.countdown_position)
            parts.append(f"{base}{cf}[countdowned]")
            base = "[countdowned]"

        # Rename last output to [vout]
        if parts:
            last = parts[-1]
            # Replace last label with [vout]
            last_label = re.search(r'\[([^\]]+)\]$', last)
            if last_label:
                parts[-1] = last[: last.rfind(f"[{last_label.group(1)}]")] + "[vout]"
            else:
                parts.append(f"{base}null[vout]")
        else:
            parts.append(f"{base}null[vout]")

        cmd += ["-filter_complex", ";".join(parts), "-map", "[vout]"] + audio_map_args
    else:
        # Use simple -vf
        vf_parts: list[str] = []

        if profile.deinterlace:
            deint_mode = getattr(profile, "deinterlace_mode", "yadif") or "yadif"
            vf_parts.append(f"{deint_mode}=0:-1:0")

        if profile.video_width or profile.video_height:
            w = profile.video_width or -2
            h = profile.video_height or -2
            alg = profile.scaling_algorithm or "lanczos"
            vf_parts.append(f"scale={w}:{h}:flags={alg}")

        # Yazi overlay (logo yok) - padding ve fade parametreleriyle
        if job.overlay_text:
            vf_parts.append(_drawtext_filter(
                job.overlay_text, job.text_position, job.text_size,
                job.text_color, job.text_bg_enabled, job.text_bg_color,
                padding_top=getattr(job, "text_padding_top", 0) or 0,
                padding_bottom=getattr(job, "text_padding_bottom", 0) or 0,
                fade_enabled=getattr(job, "text_fade_enabled", False) or False,
                fade_interval=getattr(job, "text_fade_interval", 600) or 600,
                fade_duration=getattr(job, "text_fade_duration", 20) or 20,
                fade_in_time=getattr(job, "text_fade_in_time", 3) or 3,
                fade_out_time=getattr(job, "text_fade_out_time", 3) or 3,
            ))

        if job.countdown_enabled and duration:
            vf_parts.append(_countdown_filter(duration, job.countdown_position))

        if vf_parts:
            cmd += ["-vf", ",".join(vf_parts)]

        cmd += audio_map_args

    # ---- Video codec ----
    codec_hw_map = {
        "nvenc": {"h264": "h264_nvenc", "h265": "hevc_nvenc"},
        "vaapi": {"h264": "h264_vaapi", "h265": "hevc_vaapi"},
        "qsv": {"h264": "h264_qsv", "h265": "hevc_qsv"},
    }
    if hw in codec_hw_map:
        video_codec = codec_hw_map[hw].get(profile.video_codec, profile.video_codec)
    else:
        video_codec = profile.video_codec or "h264"

    cmd += ["-c:v", video_codec]

    if profile.video_bitrate:
        cmd += ["-b:v", profile.video_bitrate]
    # CRF (only for software codecs, not hardware)
    video_crf = getattr(profile, "video_crf", None)
    if video_crf is not None and hw not in ("nvenc", "vaapi", "qsv") and hwaccel_type not in ("cuda", "vaapi", "qsv"):
        cmd += ["-crf", str(video_crf)]
    # maxrate / bufsize
    video_maxrate = getattr(profile, "video_maxrate", None)
    video_bufsize = getattr(profile, "video_bufsize", None)
    if video_maxrate:
        cmd += ["-maxrate", video_maxrate]
    if video_bufsize:
        cmd += ["-bufsize", video_bufsize]
    if profile.video_fps:
        cmd += ["-r", str(profile.video_fps)]
    # vsync
    vsync_mode = getattr(profile, "vsync_mode", "cfr") or "cfr"
    cmd += ["-vsync", vsync_mode]
    if profile.video_preset and hw not in ("vaapi",):
        cmd += ["-preset", profile.video_preset]
    if profile.video_tune:
        cmd += ["-tune", profile.video_tune]
    if profile.video_profile:
        cmd += ["-profile:v", profile.video_profile]
    if profile.video_level:
        cmd += ["-level", profile.video_level]
    cmd += ["-pix_fmt", profile.video_pixel_format or "yuv420p"]
    if profile.video_gop_size:
        cmd += ["-g", str(profile.video_gop_size), "-keyint_min", str(profile.video_gop_size)]
    if profile.video_b_frames is not None:
        cmd += ["-bf", str(profile.video_b_frames)]
    if profile.video_reference_frames:
        cmd += ["-refs", str(profile.video_reference_frames)]
    # sc_threshold
    sc_threshold = getattr(profile, "sc_threshold", 0)
    if sc_threshold is not None:
        cmd += ["-sc_threshold", str(sc_threshold)]

    # ---- Audio codec ----
    cmd += ["-c:a", profile.audio_codec or "aac"]
    if profile.audio_bitrate:
        cmd += ["-b:a", profile.audio_bitrate]
    if profile.audio_sample_rate:
        cmd += ["-ar", str(profile.audio_sample_rate)]
    if profile.audio_channels:
        cmd += ["-ac", str(profile.audio_channels)]

    af_parts: list[str] = []
    if profile.audio_normalization or getattr(profile, "audio_normalize", False):
        af_parts.append("loudnorm")
    if profile.audio_volume and profile.audio_volume != 1.0:
        af_parts.append(f"volume={profile.audio_volume:.4f}")
    if af_parts:
        cmd += ["-af", ",".join(af_parts)]

    # async audio sync
    async_audio_sync = getattr(profile, "async_audio_sync", None)
    if async_audio_sync is not None:
        cmd += ["-async", str(async_audio_sync)]

    # avoid_negative_ts
    avoid_negative_ts = getattr(profile, "avoid_negative_ts", "make_zero") or "make_zero"
    if avoid_negative_ts != "disabled":
        cmd += ["-avoid_negative_ts", avoid_negative_ts]

    # ---- x264 params ----
    x264_params = getattr(profile, "x264_params", None)
    if x264_params:
        cmd += ["-x264-params", x264_params]

    # ---- Container / movflags ----
    movflags_parts: list[str] = []
    if getattr(profile, "movflags_faststart", True):
        movflags_parts.append("+faststart")
    if profile.muxer_flags:
        movflags_parts.append(profile.muxer_flags)
    if movflags_parts and (profile.output_format or "mp4") in ("mp4", "mov"):
        cmd += ["-movflags", "".join(movflags_parts)]
    elif profile.muxer_flags and not movflags_parts:
        cmd += ["-movflags", profile.muxer_flags]

    # ---- map_metadata ----
    if getattr(profile, "map_metadata", False) is False:
        cmd += ["-map_metadata", "-1"]

    # ---- Output format ----
    if profile.output_format:
        cmd += ["-f", profile.output_format]

    # ---- Extra args ----
    if profile.extra_ffmpeg_args:
        try:
            cmd += shlex.split(profile.extra_ffmpeg_args)
        except Exception:
            pass

    # ---- Progress pipe ----
    cmd += ["-progress", "pipe:1", "-nostats"]

    cmd.append(output_path)
    return cmd


# ----- Serializer -------------------------------------------------------------

def _serialize_job(job: TranscodeJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "movie_content_id": job.movie_content_id,
        "movie_title": job.movie_content.title if job.movie_content else None,
        "movie_file_path": job.movie_content.file_path if job.movie_content else None,
        "transcode_profile_id": job.transcode_profile_id,
        "profile_name": job.transcode_profile.name if job.transcode_profile else None,
        "server_id": job.server_id,
        "server_name": job.server.name if job.server else None,
        "source_file_path": job.source_file_path,
        "output_file_path": job.output_file_path,
        "unique_number": job.unique_number,
        "overlay_text": job.overlay_text,
        "text_position": job.text_position,
        "text_size": job.text_size,
        "text_color": job.text_color,
        "text_bg_enabled": job.text_bg_enabled,
        "text_bg_color": job.text_bg_color,
        # Yazi kenar boslugu (padding)
        "text_padding_top": getattr(job, "text_padding_top", 0) or 0,
        "text_padding_bottom": getattr(job, "text_padding_bottom", 0) or 0,
        # Yazi fade in/out efekti
        "text_fade_enabled": getattr(job, "text_fade_enabled", False) or False,
        "text_fade_interval": getattr(job, "text_fade_interval", 600) or 600,
        "text_fade_duration": getattr(job, "text_fade_duration", 20) or 20,
        "text_fade_in_time": getattr(job, "text_fade_in_time", 3) or 3,
        "text_fade_out_time": getattr(job, "text_fade_out_time", 3) or 3,
        "countdown_enabled": job.countdown_enabled,
        "countdown_position": job.countdown_position,
        "status": job.status,
        "progress": job.progress,
        "eta_seconds": job.eta_seconds,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def _get_job_q(db: Session):
    return db.query(TranscodeJob).options(
        joinedload(TranscodeJob.movie_content),
        joinedload(TranscodeJob.transcode_profile),
        joinedload(TranscodeJob.server),
    )


def _get_job(db: Session, job_id: int) -> TranscodeJob:
    job = _get_job_q(db).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    return job


# ----- CRUD ------------------------------------------------------------------

def list_jobs(db: Session) -> list[dict[str, Any]]:
    jobs = _get_job_q(db).order_by(TranscodeJob.id.asc()).all()
    return [_serialize_job(j) for j in jobs]


def get_job(db: Session, job_id: int) -> dict[str, Any]:
    return _serialize_job(_get_job(db, job_id))


def create_job(db: Session, payload: TranscodeJobCreate) -> dict[str, Any]:
    movie = db.query(MovieContent).filter(MovieContent.id == payload.movie_content_id).first()
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film bulunamadi")
    if not movie.file_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Film dosya yolu tanimli degil")

    profile = db.query(TranscodeProfile).filter(TranscodeProfile.id == payload.transcode_profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode profili bulunamadi")

    # Insert job first with placeholder values to get the DB-assigned ID
    job = TranscodeJob(
        movie_content_id=payload.movie_content_id,
        transcode_profile_id=payload.transcode_profile_id,
        server_id=payload.server_id,
        source_file_path=movie.file_path,
        output_file_path=None,
        unique_number=0,  # placeholder; will be updated to job.id below
        overlay_text=payload.overlay_text,
        text_position=payload.text_position,
        text_size=payload.text_size,
        text_color=payload.text_color,
        text_bg_enabled=payload.text_bg_enabled,
        text_bg_color=payload.text_bg_color,
        # Yazi kenar boslugu
        text_padding_top=payload.text_padding_top,
        text_padding_bottom=payload.text_padding_bottom,
        # Yazi fade efekti
        text_fade_enabled=payload.text_fade_enabled,
        text_fade_interval=payload.text_fade_interval,
        text_fade_duration=payload.text_fade_duration,
        text_fade_in_time=payload.text_fade_in_time,
        text_fade_out_time=payload.text_fade_out_time,
        countdown_enabled=payload.countdown_enabled,
        countdown_position=payload.countdown_position,
        status="queued",
    )
    db.add(job)
    db.flush()  # assigns job.id without committing the transaction

    # Use job.id as unique_number: DB auto-increment guarantees it never goes down,
    # so even after deletes, new jobs always get a higher (never reused) number.
    job.unique_number = job.id
    job.output_file_path = _get_output_path(profile.name, movie.file_path, job.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return _serialize_job(_get_job(db, job.id))


def update_job(db: Session, job_id: int, payload: TranscodeJobUpdate) -> dict[str, Any]:
    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    if job.status not in ("queued", "paused", "failed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sadece kuyrukta/duraklatilmis joblar guncellenebilir")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(job, k, v)
    db.add(job)
    db.commit()
    return _serialize_job(_get_job(db, job_id))


def delete_job(db: Session, job_id: int) -> None:
    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    if job.status == "transcoding":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transcode edilen job silinemez, once durdurun")
    db.delete(job)
    db.commit()


def clear_finished_jobs(db: Session) -> int:
    q = db.query(TranscodeJob).filter(TranscodeJob.status.in_(["completed", "failed", "cancelled"]))
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return count


# ----- Queue control (called from API; actual work is in Celery) --------------

def start_job(db: Session, job_id: int) -> dict[str, Any]:
    from app.modules.transcode.tasks import run_transcode_job  # avoid circular

    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    if job.status not in ("queued", "paused", "failed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job zaten calistirilmis durumda")

    # Check no other job is currently transcoding
    active = db.query(TranscodeJob).filter(TranscodeJob.status == "transcoding").count()
    if active > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Baska bir transcode islemi devam ediyor")

    job.status = "queued"
    db.add(job)
    db.commit()
    run_transcode_job.delay(job_id)
    return _serialize_job(_get_job(db, job_id))


def stop_job(db: Session, job_id: int) -> dict[str, Any]:
    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    if job.status != "transcoding":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job transcode edilmiyor")

    job.status = "cancelled"
    job.error_message = "Kullanici tarafindan durduruldu"
    db.add(job)
    db.commit()
    return _serialize_job(_get_job(db, job_id))


def start_queue(db: Session) -> dict[str, Any]:
    from app.modules.transcode.tasks import run_transcode_job

    active = db.query(TranscodeJob).filter(TranscodeJob.status == "transcoding").count()
    if active > 0:
        return {"started": False, "message": "Zaten aktif bir transcode var"}

    job = (
        db.query(TranscodeJob)
        .filter(TranscodeJob.status == "queued")
        .order_by(TranscodeJob.id.asc())
        .first()
    )
    if job is None:
        return {"started": False, "message": "Kuyrukta bekleyen job yok"}

    run_transcode_job.delay(job.id)
    return {"started": True, "job_id": job.id}


def create_preview(db: Session, job_id: int) -> dict[str, Any]:
    from app.modules.transcode.tasks import run_preview_job

    job = _get_job(db, job_id)
    if job.status not in ("queued", "paused", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece kuyrukta/duraklatilmis joblar icin onizleme yapilabilir",
        )
    run_preview_job.delay(job_id)
    return {"job_id": job_id, "preview_path": str(PREVIEW_DIR / f"preview_{job_id}.mp4")}


# ----- Actual FFmpeg execution (called from Celery) --------------------------

def process_transcode(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = (
            db.query(TranscodeJob)
            .options(
                joinedload(TranscodeJob.movie_content),
                joinedload(TranscodeJob.transcode_profile),
                joinedload(TranscodeJob.server),
            )
            .filter(TranscodeJob.id == job_id)
            .first()
        )
        if job is None:
            return

        if job.status not in ("queued", "paused"):
            return

        profile: TranscodeProfile = job.transcode_profile

        # Mark as transcoding
        job.status = "transcoding"
        job.started_at = datetime.now(tz=timezone.utc)
        job.progress = 0.0
        job.error_message = None
        db.add(job)
        db.commit()

        duration = _get_video_duration(job.source_file_path)

        # Ensure output dir exists
        out_path = job.output_file_path or _get_output_path(
            profile.name, job.source_file_path, job.unique_number
        )
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)

        if job.server_id and job.server:
            _run_remote(db, job, profile, out_path, duration)
        else:
            _run_local(db, job, profile, out_path, duration)

    except Exception as exc:
        try:
            job_obj = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
            if job_obj:
                job_obj.status = "failed"
                job_obj.error_message = str(exc)[:2000]
                db.add(job_obj)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

    # After completion, start next queued job
    _start_next_queued(job_id)


def process_preview(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = (
            db.query(TranscodeJob)
            .options(
                joinedload(TranscodeJob.transcode_profile),
            )
            .filter(TranscodeJob.id == job_id)
            .first()
        )
        if job is None:
            return

        profile = job.transcode_profile
        preview_path = str(PREVIEW_DIR / f"preview_{job_id}.mp4")
        duration = _get_video_duration(job.source_file_path)

        job.status = "previewing"
        db.add(job)
        db.commit()

        cmd = build_ffmpeg_cmd(job, profile, preview_path, duration=duration, preview=True)
        proc = subprocess.run(cmd, capture_output=True, timeout=120)

        if proc.returncode == 0:
            job.status = "queued"
            job.error_message = None
        else:
            job.status = "queued"
            job.error_message = f"Onizleme hatasi: {proc.stderr.decode(errors='ignore')[:500]}"
        db.add(job)
        db.commit()
    except Exception as exc:
        try:
            job_obj = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
            if job_obj:
                job_obj.status = "queued"
                job_obj.error_message = f"Onizleme hatasi: {str(exc)[:500]}"
                db.add(job_obj)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _run_local(
    db: Session,
    job: TranscodeJob,
    profile: TranscodeProfile,
    out_path: str,
    duration: float | None,
) -> None:
    cmd = build_ffmpeg_cmd(job, profile, out_path, duration=duration)

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    last_db_update = time.time()
    progress_data: dict[str, str] = {}

    while True:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                break
            continue

        line = line.strip()
        if "=" in line:
            key, _, val = line.partition("=")
            progress_data[key.strip()] = val.strip()

        if progress_data.get("progress") in ("continue", "end"):
            # Parse out_time_ms
            out_time_ms = progress_data.get("out_time_ms")
            speed_str = progress_data.get("speed", "1x").rstrip("x")
            pct = 0.0
            eta = None
            if duration and out_time_ms:
                try:
                    current_s = int(out_time_ms) / 1_000_000
                    pct = min(100.0, current_s / duration * 100)
                    speed = float(speed_str) if speed_str else 1.0
                    if speed > 0:
                        remaining = duration - current_s
                        eta = int(remaining / speed)
                except Exception:
                    pass

            now = time.time()
            if now - last_db_update >= 2.0:
                try:
                    db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
                        {"progress": pct, "eta_seconds": eta}
                    )
                    db.commit()
                except Exception:
                    db.rollback()
                last_db_update = now

            if progress_data.get("progress") == "end":
                break

            progress_data = {}

        # Check if job was cancelled
        if time.time() - last_db_update >= 3.0:
            fresh = db.query(TranscodeJob).filter(TranscodeJob.id == job.id).first()
            if fresh and fresh.status == "cancelled":
                proc.kill()
                return
            last_db_update = time.time()

    proc.wait()

    fresh = db.query(TranscodeJob).filter(TranscodeJob.id == job.id).first()
    if fresh and fresh.status == "cancelled":
        return

    if proc.returncode == 0:
        db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
            {
                "status": "completed",
                "progress": 100.0,
                "eta_seconds": 0,
                "completed_at": datetime.now(tz=timezone.utc),
            }
        )
        db.commit()
    else:
        stderr_out = proc.stderr.read() if proc.stderr else ""
        db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
            {
                "status": "failed",
                "error_message": stderr_out[-2000:] if stderr_out else "FFmpeg hatasi",
            }
        )
        db.commit()


def _ssh_connect(server: Server, password: str) -> paramiko.SSHClient:
    """Create and return an authenticated SSH client."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        server.ip_address,
        port=server.ssh_port or 22,
        username=server.ssh_username or "root",
        password=password,
        timeout=30,
    )
    return ssh


def _ensure_ffmpeg_on_remote(ssh: paramiko.SSHClient) -> None:
    """Install ffmpeg on the remote server if it's not present."""
    stdin, stdout, stderr = ssh.exec_command("which ffmpeg || command -v ffmpeg")
    stdout.channel.recv_exit_status()
    result = stdout.read().strip()
    if not result:
        # ffmpeg not found, install it
        stdin, stdout, stderr = ssh.exec_command(
            "apt-get update -qq && apt-get install -y ffmpeg",
            timeout=300,
        )
        stdout.channel.recv_exit_status()


def _run_remote(
    db: Session,
    job: TranscodeJob,
    profile: TranscodeProfile,
    out_path: str,
    duration: float | None,
) -> None:
    server: Server = job.server
    from app.core.security import decrypt_secret

    try:
        password = decrypt_secret(server.ssh_password)
    except Exception:
        password = server.ssh_password

    ssh = _ssh_connect(server, password)
    try:
        # Ensure ffmpeg is available on the remote server
        _ensure_ffmpeg_on_remote(ssh)

        sftp = ssh.open_sftp()
        src_ext = Path(job.source_file_path).suffix or ".mp4"
        remote_input = f"/tmp/vod_input_{job.id}{src_ext}"
        remote_output = f"/tmp/vod_output_{job.id}.mp4"

        # Upload source file to remote
        sftp.put(job.source_file_path, remote_input)

        # Upload logo file to remote if profile has one
        remote_logo: str | None = None
        if profile.logo_path and os.path.exists(str(profile.logo_path)):
            logo_ext = Path(str(profile.logo_path)).suffix or ".png"
            remote_logo = f"/tmp/vod_logo_{job.id}{logo_ext}"
            sftp.put(str(profile.logo_path), remote_logo)

        # Build ffmpeg command using remote paths
        cmd_list = build_ffmpeg_cmd(
            job, profile, remote_output, duration=duration,
            source_override=remote_input,
            logo_path_override=remote_logo,
        )
        cmd_str = " ".join(shlex.quote(c) for c in cmd_list)

        # Run ffmpeg on remote; pipe:1 = stdout for progress
        stdin, stdout, stderr = ssh.exec_command(cmd_str, get_pty=False)
        stdin.close()

        last_db_update = time.time()
        for line in stdout:
            line = line.strip()
            if "out_time_ms=" in line:
                try:
                    val = int(line.split("=")[1])
                    current_s = val / 1_000_000
                    pct = min(100.0, current_s / duration * 100) if duration else 0.0
                    now = time.time()
                    if now - last_db_update >= 2.0:
                        db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
                            {"progress": pct}
                        )
                        db.commit()
                        last_db_update = now
                except Exception:
                    pass

        exit_code = stdout.channel.recv_exit_status()

        if exit_code == 0:
            # Download the output file back to local output path
            Path(out_path).parent.mkdir(parents=True, exist_ok=True)
            sftp.get(remote_output, out_path)
            db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
                {
                    "status": "completed",
                    "progress": 100.0,
                    "completed_at": datetime.now(tz=timezone.utc),
                }
            )
        else:
            err = stderr.read().decode(errors="ignore")[-2000:]
            db.query(TranscodeJob).filter(TranscodeJob.id == job.id).update(
                {"status": "failed", "error_message": err or "Remote FFmpeg hatasi"}
            )
        db.commit()

        # Cleanup remote temp files
        cleanup_paths = [remote_input, remote_output]
        if remote_logo:
            cleanup_paths.append(remote_logo)
        for remote_path in cleanup_paths:
            try:
                sftp.remove(remote_path)
            except Exception:
                pass
        sftp.close()
    finally:
        ssh.close()


def _start_next_queued(completed_job_id: int) -> None:
    from app.modules.transcode.tasks import run_transcode_job

    db = SessionLocal()
    try:
        next_job = (
            db.query(TranscodeJob)
            .filter(TranscodeJob.status == "queued", TranscodeJob.id != completed_job_id)
            .order_by(TranscodeJob.id.asc())
            .first()
        )
        if next_job:
            run_transcode_job.delay(next_job.id)
    finally:
        db.close()
