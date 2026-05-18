from __future__ import annotations

import subprocess
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.playlist.models import Playlist, PlaylistItem, InfoScreenTemplate
from app.modules.playlist.schemas import PlaylistCreate, PlaylistItemAdd, PlaylistItemReorder, PlaylistUpdate
from app.modules.transcode.models import TranscodeJob


def ensure_default_info_screen_template(db: Session) -> None:
    existing = db.query(InfoScreenTemplate).filter_by(is_default=True).first()
    if not existing:
        db.add(InfoScreenTemplate(
            name="Sinema (Varsayılan)",
            is_default=True,
            bg_image_url=None,
            title_text="ŞU ANDA YAYINDA OLANLAR",
            subtitle_text="SİNEMA KANALLARI",
            primary_color="#D4A843",
            bg_overlay_opacity=70,
            font_family="serif",
            layout="cinema",
            refresh_interval=30,
        ))
        db.commit()


def _get_stream_info(pl: Playlist) -> dict[str, Any] | None:
    if not pl.items:
        return None
    first_item = sorted(pl.items, key=lambda i: i.position)[0]
    job = first_item.transcode_job if hasattr(first_item, "transcode_job") else None
    if not job:
        return None
    profile = job.transcode_profile if hasattr(job, "transcode_profile") else None
    if not profile:
        return None
    return {
        "video_codec": profile.video_codec,
        "audio_codec": profile.audio_codec,
        "fps": profile.video_fps,
        "bitrate": profile.video_bitrate,
        "width": profile.video_width,
        "height": profile.video_height,
        "logo_path": profile.logo_path,
        "profile_name": profile.name,
    }


def _get_video_duration(file_path: str) -> int:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", file_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        val = result.stdout.strip()
        return int(float(val)) if val else 0
    except Exception:
        return 0


def _serialize_item(item: PlaylistItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "playlist_id": item.playlist_id,
        "transcode_job_id": item.transcode_job_id,
        "position": item.position,
        "title": item.title,
        "duration_seconds": item.duration_seconds,
        "file_path": item.file_path,
        "tmdb_id": item.tmdb_id,
        "tmdb_title": item.tmdb_title,
        "tmdb_overview": item.tmdb_overview,
        "tmdb_poster_url": item.tmdb_poster_url,
        "is_visible_in_category": item.is_visible_in_category,
        "created_at": item.created_at,
    }


def _serialize_playlist(pl: Playlist, include_items: bool = False) -> dict[str, Any]:
    return {
        "id": pl.id,
        "name": pl.name,
        "description": pl.description,
        "status": pl.status,
        "server_id": pl.server_id,
        "server_name": pl.server.name if pl.server else None,
        "current_item_index": pl.current_item_index,
        "started_at": pl.started_at,
        "total_duration_seconds": pl.total_duration_seconds,
        "loop": pl.loop,
        "ffmpeg_pid": pl.ffmpeg_pid,
        "stream_url": pl.stream_url,
        "item_count": len(pl.items),
        "created_at": pl.created_at,
        "updated_at": pl.updated_at,
        "items": [_serialize_item(i) for i in pl.items] if include_items else [],
        "stream_info": _get_stream_info(pl),
    }


def _get_playlist_q(db: Session):
    return db.query(Playlist).options(
        joinedload(Playlist.server),
        joinedload(Playlist.items).joinedload(PlaylistItem.transcode_job).joinedload(TranscodeJob.transcode_profile),
    )


def list_playlists(db: Session) -> list[dict[str, Any]]:
    playlists = _get_playlist_q(db).order_by(Playlist.id.desc()).all()
    return [_serialize_playlist(pl, include_items=True) for pl in playlists]


def get_playlist(db: Session, playlist_id: int) -> dict[str, Any]:
    pl = _get_playlist_q(db).filter(Playlist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
    return _serialize_playlist(pl, include_items=True)


def create_playlist(db: Session, payload: PlaylistCreate) -> dict[str, Any]:
    pl = Playlist(
        name=payload.name,
        description=payload.description,
        server_id=payload.server_id,
        loop=payload.loop,
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return _serialize_playlist(_get_playlist_q(db).filter(Playlist.id == pl.id).first(), include_items=True)


def update_playlist(db: Session, playlist_id: int, payload: PlaylistUpdate) -> dict[str, Any]:
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(pl, k, v)
    db.add(pl)
    db.commit()
    return _serialize_playlist(_get_playlist_q(db).filter(Playlist.id == playlist_id).first(), include_items=True)


def delete_playlist(db: Session, playlist_id: int) -> None:
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
    # Bouquet referanslarini temizle (orphan kalmasi icin)
    from app.modules.content.models import BouquetItem, BouquetItemType
    db.query(BouquetItem).filter(
        BouquetItem.item_type == BouquetItemType.vod_channel,
        BouquetItem.item_id == playlist_id,
    ).delete(synchronize_session=False)
    db.delete(pl)
    db.commit()


def add_item(db: Session, playlist_id: int, payload: PlaylistItemAdd) -> dict[str, Any]:
    pl = _get_playlist_q(db).filter(Playlist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")

    job = (
        db.query(TranscodeJob)
        .options(
            joinedload(TranscodeJob.movie_content),
            joinedload(TranscodeJob.transcode_profile),
        )
        .filter(TranscodeJob.id == payload.transcode_job_id)
        .first()
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcode job bulunamadi")
    if job.status not in ("completed", "archived"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sadece tamamlanmis joblar eklenebilir")

    # Check not already in this playlist
    existing = (
        db.query(PlaylistItem)
        .filter(
            PlaylistItem.playlist_id == playlist_id,
            PlaylistItem.transcode_job_id == payload.transcode_job_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu video zaten bu playlist'te")

    max_pos = max((i.position for i in pl.items), default=0)

    file_path = job.output_file_path or ""
    duration = _get_video_duration(file_path) if file_path else 0

    movie = job.movie_content
    item = PlaylistItem(
        playlist_id=playlist_id,
        transcode_job_id=job.id,
        position=max_pos + 1,
        title=movie.title if movie else f"Job #{job.id}",
        duration_seconds=duration,
        file_path=file_path,
        tmdb_id=movie.tmdb_id if movie else None,
        tmdb_title=movie.title if movie else None,
        tmdb_overview=movie.description if movie else None,
        tmdb_poster_url=movie.poster_url if movie else None,
        is_visible_in_category=False,
    )
    db.add(item)

    pl.total_duration_seconds = pl.total_duration_seconds + duration
    db.add(pl)
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


def remove_item(db: Session, playlist_id: int, item_id: int) -> None:
    item = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.id == item_id, PlaylistItem.playlist_id == playlist_id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist item bulunamadi")

    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if pl:
        pl.total_duration_seconds = max(0, pl.total_duration_seconds - item.duration_seconds)
        db.add(pl)

    db.delete(item)
    db.commit()

    # Re-index positions
    remaining = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.playlist_id == playlist_id)
        .order_by(PlaylistItem.position.asc())
        .all()
    )
    for idx, i in enumerate(remaining):
        i.position = idx + 1
        db.add(i)
    db.commit()


def reorder_items(db: Session, playlist_id: int, payload: PlaylistItemReorder) -> dict[str, Any]:
    pl = _get_playlist_q(db).filter(Playlist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")

    item_map = {i.id: i for i in pl.items}
    for pos, item_id in enumerate(payload.item_ids, start=1):
        if item_id in item_map:
            item_map[item_id].position = pos
            db.add(item_map[item_id])
    db.commit()
    return _serialize_playlist(_get_playlist_q(db).filter(Playlist.id == playlist_id).first(), include_items=True)


def list_completed_jobs_for_profile(db: Session, profile_id: int) -> list[dict[str, Any]]:
    """List completed transcode jobs for a profile, marking ones already in a playlist."""
    from app.modules.transcode.job_service import _serialize_job

    # Job IDs already in a playlist (is_visible_in_category=False)
    used_job_ids = set(
        row[0]
        for row in db.query(PlaylistItem.transcode_job_id)
        .filter(PlaylistItem.is_visible_in_category == False)  # noqa: E712
        .all()
    )

    jobs = (
        db.query(TranscodeJob)
        .options(
            joinedload(TranscodeJob.movie_content),
            joinedload(TranscodeJob.transcode_profile),
            joinedload(TranscodeJob.server),
        )
        .filter(
            TranscodeJob.transcode_profile_id == profile_id,
            TranscodeJob.status.in_(["completed", "archived"]),
        )
        .order_by(TranscodeJob.id.desc())
        .all()
    )

    result = []
    for job in jobs:
        d = _serialize_job(job)
        d["is_in_playlist"] = job.id in used_job_ids
        result.append(d)
    return result
