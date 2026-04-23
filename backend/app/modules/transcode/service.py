import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.transcode.models import TranscodeProfile
from app.modules.transcode.schemas import TranscodeProfileCreate, TranscodeProfileUpdate
from app.modules.content.models import MovieCategory

LOGO_DIR = Path("/var/www/vod-manager/shared/uploads/channel-logos")
LOGO_URL_PREFIX = "/uploads/channel-logos"


def _logo_url(logo_path: str | None) -> str | None:
    if not logo_path:
        return None
    filename = os.path.basename(logo_path)
    return f"{LOGO_URL_PREFIX}/{filename}"


def _serialize(profile: TranscodeProfile) -> dict[str, Any]:
    return {
        "id": profile.id,
        "name": profile.name,
        "logo_path": profile.logo_path,
        "logo_url": _logo_url(profile.logo_path),
        "logo_width": profile.logo_width,
        "logo_height": profile.logo_height,
        "logo_position": profile.logo_position,
        "logo_opacity": profile.logo_opacity,
        "logo_margin_x": profile.logo_margin_x if profile.logo_margin_x is not None else 10,
        "logo_margin_y": profile.logo_margin_y if profile.logo_margin_y is not None else 10,
        "video_codec": profile.video_codec,
        "video_bitrate": profile.video_bitrate,
        "video_maxrate": profile.video_maxrate,
        "video_bufsize": profile.video_bufsize,
        "video_crf": profile.video_crf,
        "video_width": profile.video_width,
        "video_height": profile.video_height,
        "video_fps": profile.video_fps,
        "video_profile": profile.video_profile,
        "video_level": profile.video_level,
        "video_preset": profile.video_preset,
        "video_tune": profile.video_tune,
        "video_pixel_format": profile.video_pixel_format,
        "video_gop_size": profile.video_gop_size,
        "video_b_frames": profile.video_b_frames,
        "video_reference_frames": profile.video_reference_frames,
        "deinterlace": profile.deinterlace,
        "deinterlace_mode": profile.deinterlace_mode if profile.deinterlace_mode else "yadif",
        "scaling_algorithm": profile.scaling_algorithm,
        "sc_threshold": profile.sc_threshold if profile.sc_threshold is not None else 0,
        "audio_codec": profile.audio_codec,
        "audio_bitrate": profile.audio_bitrate,
        "audio_sample_rate": profile.audio_sample_rate,
        "audio_channels": profile.audio_channels,
        "audio_volume": profile.audio_volume,
        "audio_normalization": profile.audio_normalization,
        "async_audio_sync": profile.async_audio_sync,
        "audio_map": profile.audio_map,
        "audio_map_channel": profile.audio_map_channel,
        "audio_normalize": profile.audio_normalize,
        "output_format": profile.output_format,
        "output_type": profile.output_type if profile.output_type else "channel_ready",
        "container_format": profile.container_format if profile.container_format else "mp4",
        "muxer_flags": profile.muxer_flags,
        "segment_duration": profile.segment_duration,
        "movflags_faststart": profile.movflags_faststart,
        "map_metadata": profile.map_metadata,
        "vsync_mode": profile.vsync_mode if profile.vsync_mode else "cfr",
        "avoid_negative_ts": profile.avoid_negative_ts if profile.avoid_negative_ts else "make_zero",
        "fflags_mode": profile.fflags_mode if profile.fflags_mode else "+genpts",
        "thread_queue_size": profile.thread_queue_size if profile.thread_queue_size is not None else 512,
        "hardware_accel": profile.hardware_accel,
        "hwaccel_type": profile.hwaccel_type,
        "extra_ffmpeg_args": profile.extra_ffmpeg_args,
        "x264_params": profile.x264_params,
        "is_default": profile.is_default,
        "hidden_category_id": profile.hidden_category_id,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def list_profiles(db: Session) -> list[dict[str, Any]]:
    profiles = db.query(TranscodeProfile).order_by(TranscodeProfile.name.asc()).all()
    return [_serialize(p) for p in profiles]


def get_profile(db: Session, profile_id: int) -> dict[str, Any]:
    profile = db.query(TranscodeProfile).filter(TranscodeProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode profili bulunamadi")
    return _serialize(profile)


def _create_hidden_category(db: Session, name: str) -> MovieCategory:
    cat = MovieCategory(
        name=name,
        is_hidden=True,
        is_active=True,
        sort_order=9999,
    )
    db.add(cat)
    db.flush()
    return cat


def create_profile(db: Session, payload: TranscodeProfileCreate) -> dict[str, Any]:
    data = payload.model_dump()

    # If setting as default, unset others
    if data.get("is_default"):
        db.query(TranscodeProfile).filter(TranscodeProfile.is_default == True).update({"is_default": False})  # noqa: E712

    # Create hidden category
    hidden_cat = _create_hidden_category(db, payload.name)

    profile = TranscodeProfile(**data, hidden_category_id=hidden_cat.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _serialize(profile)


def update_profile(db: Session, profile_id: int, payload: TranscodeProfileUpdate) -> dict[str, Any]:
    profile = db.query(TranscodeProfile).filter(TranscodeProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode profili bulunamadi")

    data = payload.model_dump(exclude_unset=True)

    if data.get("is_default"):
        db.query(TranscodeProfile).filter(TranscodeProfile.is_default == True, TranscodeProfile.id != profile_id).update({"is_default": False})  # noqa: E712

    # Sync hidden category name if name changes
    if "name" in data and profile.hidden_category_id:
        hidden_cat = db.query(MovieCategory).filter(MovieCategory.id == profile.hidden_category_id).first()
        if hidden_cat:
            hidden_cat.name = data["name"]
            db.add(hidden_cat)

    for key, value in data.items():
        setattr(profile, key, value)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _serialize(profile)


def delete_profile(db: Session, profile_id: int) -> None:
    profile = db.query(TranscodeProfile).filter(TranscodeProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode profili bulunamadi")

    # Delete logo file if exists
    if profile.logo_path:
        try:
            logo_file = Path(profile.logo_path)
            if logo_file.exists():
                logo_file.unlink()
        except Exception:
            pass

    # Delete hidden category
    if profile.hidden_category_id:
        hidden_cat = db.query(MovieCategory).filter(MovieCategory.id == profile.hidden_category_id).first()
        if hidden_cat:
            db.delete(hidden_cat)

    db.delete(profile)
    db.commit()


def update_logo(db: Session, profile_id: int, filename: str, content: bytes) -> dict[str, Any]:
    profile = db.query(TranscodeProfile).filter(TranscodeProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode profili bulunamadi")

    LOGO_DIR.mkdir(parents=True, exist_ok=True)

    # Delete old logo
    if profile.logo_path:
        try:
            old_file = Path(profile.logo_path)
            if old_file.exists():
                old_file.unlink()
        except Exception:
            pass

    dest = LOGO_DIR / filename
    dest.write_bytes(content)

    profile.logo_path = str(dest)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _serialize(profile)
