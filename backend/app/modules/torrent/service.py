"""Torrent download service using libtorrent (python-libtorrent).

The libtorrent session runs inside the FastAPI process as a background thread.
This allows instant pause/resume/cancel operations through the same process.
On startup (called from main.py lifespan), the session is initialized and all
active/paused DB records are re-added to the session to survive restarts.
"""
from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.content.models import MovieContent, SeriesContent, SeriesSeason, SeriesEpisode
from app.modules.torrent.models import TorrentDownload, TorrentCategory, TorrentStatus
from app.modules.torrent.schemas import TorrentAddRequest, TMDBResult

logger = logging.getLogger(__name__)

# ─── Torrent save directory ──────────────────────────────────────────────────
TORRENT_SAVE_PATH = Path("/var/www/vod-manager/shared/downloads/torrents")
TORRENT_FILES_PATH = TORRENT_SAVE_PATH / ".torrent_files"

# ─── libtorrent availability ─────────────────────────────────────────────────
try:
    import libtorrent as lt  # type: ignore[import]
    _LT_AVAILABLE = True
except ImportError:
    lt = None  # type: ignore[assignment]
    _LT_AVAILABLE = False
    logger.warning("libtorrent not installed — torrent downloads unavailable. Run: apt install python3-libtorrent")

# ─── Global state ─────────────────────────────────────────────────────────────
_session: Any = None          # libtorrent.session
_handles: dict[int, Any] = {}  # db_id → libtorrent.torrent_handle
_monitor_thread: threading.Thread | None = None
_lock = threading.Lock()


def _ensure_lt() -> None:
    if not _LT_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="libtorrent kurulu degil. Sunucuda: apt install python3-libtorrent",
        )


def _get_or_create_session() -> Any:
    global _session
    if _session is None:
        _session = lt.session({"listen_interfaces": "0.0.0.0:6881"})
        logger.info("libtorrent session initialized")
    return _session


# ─── libtorrent state → TorrentStatus mapping ────────────────────────────────
_LT_STATE_MAP: dict[int, TorrentStatus] = {}


def _map_lt_state(s: Any, paused: bool) -> TorrentStatus:
    if paused:
        return TorrentStatus.paused
    try:
        state_name = str(s.state).split(".")[-1]
    except Exception:
        state_name = ""
    mapping = {
        "checking_files": TorrentStatus.downloading,
        "downloading_metadata": TorrentStatus.downloading,
        "downloading": TorrentStatus.downloading,
        "finished": TorrentStatus.seeding,
        "seeding": TorrentStatus.seeding,
        "allocating": TorrentStatus.downloading,
        "checking_resume_data": TorrentStatus.downloading,
    }
    return mapping.get(state_name, TorrentStatus.downloading)


# ─── Background monitor thread ───────────────────────────────────────────────

def _monitor_loop() -> None:
    """Runs every 5 seconds; updates DB from libtorrent status."""
    while True:
        time.sleep(5)
        if not _LT_AVAILABLE:
            continue
        with _lock:
            handle_snapshot = dict(_handles)

        db = SessionLocal()
        try:
            for db_id, handle in handle_snapshot.items():
                if not handle.is_valid():
                    continue
                try:
                    _update_db_from_handle(db, db_id, handle)
                except Exception as exc:
                    logger.warning("Torrent monitor error for id=%s: %s", db_id, exc)
                    db.rollback()
        finally:
            db.close()


def _update_db_from_handle(db: Session, db_id: int, handle: Any) -> None:
    record = db.query(TorrentDownload).filter(TorrentDownload.id == db_id).first()
    if record is None:
        return

    s = handle.status()
    paused = s.paused if hasattr(s, "paused") else handle.is_paused()

    new_status = _map_lt_state(s, paused)
    progress = round(s.progress * 100, 1)
    dl_speed = round(s.download_rate / 1024 / 1024, 3)  # bytes/s → MB/s
    ul_speed = round(s.upload_rate / 1024 / 1024, 3)
    total = s.total_wanted
    done = s.total_wanted_done
    eta: int | None = None
    if s.download_rate > 0 and total and done < total:
        eta = int((total - done) / s.download_rate)

    # Auto-stop seeding when no_seed=True and download finished
    if record.no_seed and new_status == TorrentStatus.seeding and not paused:
        try:
            handle.set_upload_limit(0)  # Stop uploading
            handle.pause()
        except Exception:
            pass
        new_status = TorrentStatus.completed
        paused = True

    record.status = new_status
    record.progress = progress
    record.download_speed = dl_speed if dl_speed > 0 else None
    record.upload_speed = ul_speed if ul_speed > 0 else None
    record.size_total = total if total > 0 else None
    record.size_downloaded = done if done > 0 else None
    record.eta_seconds = eta

    # Auto name from metadata if we stored a placeholder
    if record.name.startswith("Magnet:") and handle.has_metadata():
        ti = handle.get_torrent_info()
        record.name = ti.name()

    db.add(record)
    db.commit()

    # On completion, trigger file registration
    if new_status in (TorrentStatus.seeding, TorrentStatus.completed) and record.status != TorrentStatus.completed:
        _register_completed(db, record, handle)


def _register_completed(db: Session, record: TorrentDownload, handle: Any) -> None:
    """Move completed files to content library."""
    try:
        if record.status == TorrentStatus.completed:
            return  # Already processed

        record.status = TorrentStatus.completed
        record.progress = 100.0
        record.download_speed = None
        record.eta_seconds = None
        db.add(record)
        db.commit()

        if not handle.has_metadata():
            return

        ti = handle.get_torrent_info()
        save_path = Path(handle.status().save_path)
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".ts", ".m2ts"}

        for i in range(ti.num_files()):
            f = ti.files().file_path(i)
            file_path = save_path / f
            if file_path.suffix.lower() not in video_exts:
                continue
            if not file_path.exists():
                continue

            if record.category == TorrentCategory.movie and record.category_id:
                existing = db.query(MovieContent).filter(MovieContent.file_path == str(file_path)).first()
                if existing is None:
                    movie = MovieContent(
                        title=record.name,
                        category_id=record.category_id,
                        file_path=str(file_path),
                        file_size_bytes=file_path.stat().st_size,
                        is_public=True,
                    )
                    db.add(movie)
                    db.commit()
                    logger.info("Torrent completed: registered MovieContent id=%s", movie.id)

            elif record.category == TorrentCategory.series and record.category_id:
                # Find or create SeriesContent for this category
                series = db.query(SeriesContent).filter(
                    SeriesContent.title == record.name,
                    SeriesContent.category_id == record.category_id,
                ).first()
                if series is None:
                    series = SeriesContent(
                        title=record.name,
                        category_id=record.category_id,
                    )
                    db.add(series)
                    db.flush()

                # Find or create Season 1
                season = db.query(SeriesSeason).filter(
                    SeriesSeason.series_id == series.id,
                    SeriesSeason.season_number == 1,
                ).first()
                if season is None:
                    season = SeriesSeason(series_id=series.id, season_number=1)
                    db.add(season)
                    db.flush()

                # Count existing episodes for numbering
                ep_count = db.query(SeriesEpisode).filter(
                    SeriesEpisode.season_id == season.id
                ).count()

                episode = SeriesEpisode(
                    season_id=season.id,
                    episode_number=ep_count + 1,
                    title=file_path.stem,
                    file_path=str(file_path),
                )
                db.add(episode)
                db.commit()
                logger.info("Torrent completed: registered SeriesEpisode for series id=%s", series.id)

    except Exception as exc:
        logger.error("Error registering completed torrent id=%s: %s", record.id, exc)
        db.rollback()


def start_session_and_monitor() -> None:
    """Called from FastAPI lifespan to init session and start monitor thread."""
    global _monitor_thread
    if not _LT_AVAILABLE:
        return

    _get_or_create_session()
    TORRENT_SAVE_PATH.mkdir(parents=True, exist_ok=True)
    TORRENT_FILES_PATH.mkdir(parents=True, exist_ok=True)

    # Resume active/paused torrents from DB
    db = SessionLocal()
    try:
        active_records = db.query(TorrentDownload).filter(
            TorrentDownload.status.in_([TorrentStatus.downloading, TorrentStatus.paused, TorrentStatus.seeding])
        ).all()
        for record in active_records:
            if record.magnet_link:
                _add_magnet_to_session(record.id, record.magnet_link, str(record.save_path or TORRENT_SAVE_PATH))
                if record.status == TorrentStatus.paused:
                    with _lock:
                        h = _handles.get(record.id)
                        if h:
                            h.pause()
                # Apply no_seed upload limit
                if record.no_seed:
                    with _lock:
                        h = _handles.get(record.id)
                        if h and h.is_valid():
                            try:
                                h.set_upload_limit(0)
                            except Exception:
                                pass
            elif record.torrent_file_path:
                tp = Path(record.torrent_file_path)
                if tp.exists():
                    _add_torrent_file_to_session(record.id, tp, str(record.save_path or TORRENT_SAVE_PATH))
                    if record.status == TorrentStatus.paused:
                        with _lock:
                            h = _handles.get(record.id)
                            if h:
                                h.pause()
        logger.info("Resumed %d torrents from DB on startup", len(active_records))
    finally:
        db.close()

    if _monitor_thread is None or not _monitor_thread.is_alive():
        _monitor_thread = threading.Thread(target=_monitor_loop, daemon=True, name="torrent-monitor")
        _monitor_thread.start()
        logger.info("Torrent monitor thread started")


def _add_magnet_to_session(db_id: int, magnet: str, save_path: str) -> Any:
    sess = _get_or_create_session()
    params = lt.add_torrent_params()  # type: ignore[attr-defined]
    params.save_path = save_path
    handle = lt.add_magnet_uri(sess, magnet, params)  # type: ignore[attr-defined]
    with _lock:
        _handles[db_id] = handle
    return handle


def _add_torrent_file_to_session(db_id: int, torrent_path: Path, save_path: str) -> Any:
    """Add a .torrent file to the libtorrent session."""
    sess = _get_or_create_session()
    ti = lt.torrent_info(str(torrent_path))  # type: ignore[attr-defined]
    params = lt.add_torrent_params()  # type: ignore[attr-defined]
    params.ti = ti
    params.save_path = save_path
    handle = sess.add_torrent(params)
    with _lock:
        _handles[db_id] = handle
    return handle


# ─── Public service functions ─────────────────────────────────────────────────

def _serialize(record: TorrentDownload) -> dict:
    return {
        "id": record.id,
        "name": record.name,
        "magnet_link": record.magnet_link,
        "torrent_file_path": record.torrent_file_path,
        "category": record.category.value if hasattr(record.category, "value") else record.category,
        "category_id": record.category_id,
        "status": record.status.value if hasattr(record.status, "value") else record.status,
        "progress": record.progress,
        "download_speed": record.download_speed,
        "upload_speed": record.upload_speed,
        "size_total": record.size_total,
        "size_downloaded": record.size_downloaded,
        "eta_seconds": record.eta_seconds,
        "save_path": record.save_path,
        "info_hash": record.info_hash,
        "error_message": record.error_message,
        "no_seed": record.no_seed if record.no_seed is not None else True,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def add_torrent(db: Session, payload: TorrentAddRequest) -> dict:
    _ensure_lt()

    TORRENT_SAVE_PATH.mkdir(parents=True, exist_ok=True)

    # Derive name from magnet link if not provided
    name = payload.name
    if not name:
        import re
        dn_match = re.search(r"dn=([^&]+)", payload.magnet_link)
        if dn_match:
            from urllib.parse import unquote_plus
            name = unquote_plus(dn_match.group(1))[:499]
        else:
            name = f"Magnet:{payload.magnet_link[7:17]}..."

    record = TorrentDownload(
        name=name,
        magnet_link=payload.magnet_link,
        category=TorrentCategory(payload.category),
        category_id=payload.category_id,
        status=TorrentStatus.downloading,
        progress=0.0,
        save_path=str(TORRENT_SAVE_PATH),
        no_seed=payload.no_seed,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        handle = _add_magnet_to_session(record.id, payload.magnet_link, str(TORRENT_SAVE_PATH))
        if payload.no_seed:
            try:
                handle.set_upload_limit(0)
            except Exception:
                pass
    except Exception as exc:
        record.status = TorrentStatus.error
        record.error_message = str(exc)
        db.add(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return _serialize(record)


async def add_torrent_from_file(
    db: Session,
    file: UploadFile,
    name: str | None,
    category: str,
    category_id: int | None,
    no_seed: bool,
) -> dict:
    """Add a torrent from an uploaded .torrent file."""
    _ensure_lt()

    TORRENT_SAVE_PATH.mkdir(parents=True, exist_ok=True)
    TORRENT_FILES_PATH.mkdir(parents=True, exist_ok=True)

    # Save uploaded file
    safe_name = Path(file.filename or "torrent.torrent").name
    dest = TORRENT_FILES_PATH / safe_name
    # Avoid overwriting by suffixing
    counter = 1
    while dest.exists():
        dest = TORRENT_FILES_PATH / f"{dest.stem}_{counter}{dest.suffix}"
        counter += 1

    content = await file.read()
    dest.write_bytes(content)

    # Parse torrent info for display name
    try:
        ti = lt.torrent_info(str(dest))  # type: ignore[attr-defined]
        display_name = name or ti.name() or dest.stem
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gecersiz .torrent dosyasi: {exc}",
        ) from exc

    record = TorrentDownload(
        name=display_name[:499],
        torrent_file_path=str(dest),
        category=TorrentCategory(category),
        category_id=category_id,
        status=TorrentStatus.downloading,
        progress=0.0,
        save_path=str(TORRENT_SAVE_PATH),
        no_seed=no_seed,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        handle = _add_torrent_file_to_session(record.id, dest, str(TORRENT_SAVE_PATH))
        if no_seed:
            try:
                handle.set_upload_limit(0)
            except Exception:
                pass
    except Exception as exc:
        record.status = TorrentStatus.error
        record.error_message = str(exc)
        db.add(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return _serialize(record)


def list_torrents(db: Session) -> list[dict]:
    records = db.query(TorrentDownload).order_by(TorrentDownload.created_at.desc()).all()
    return [_serialize(r) for r in records]


def get_torrent(db: Session, torrent_id: int) -> TorrentDownload:
    record = db.query(TorrentDownload).filter(TorrentDownload.id == torrent_id).first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torrent bulunamadi")
    return record


def pause_torrent(db: Session, torrent_id: int) -> dict:
    _ensure_lt()
    record = get_torrent(db, torrent_id)
    with _lock:
        handle = _handles.get(torrent_id)
    if handle and handle.is_valid():
        handle.pause()
    record.status = TorrentStatus.paused
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize(record)


def resume_torrent(db: Session, torrent_id: int) -> dict:
    _ensure_lt()
    record = get_torrent(db, torrent_id)
    with _lock:
        handle = _handles.get(torrent_id)

    if handle and handle.is_valid():
        handle.resume()
    elif record.magnet_link:
        handle = _add_magnet_to_session(torrent_id, record.magnet_link, str(record.save_path or TORRENT_SAVE_PATH))
    elif record.torrent_file_path:
        tp = Path(record.torrent_file_path)
        if tp.exists():
            handle = _add_torrent_file_to_session(torrent_id, tp, str(record.save_path or TORRENT_SAVE_PATH))

    # Re-apply no_seed upload limit
    if handle and handle.is_valid() and record.no_seed:
        try:
            handle.set_upload_limit(0)
        except Exception:
            pass

    record.status = TorrentStatus.downloading
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize(record)


def delete_torrent(db: Session, torrent_id: int, remove_files: bool = False) -> None:
    record = get_torrent(db, torrent_id)
    with _lock:
        handle = _handles.pop(torrent_id, None)

    if handle and handle.is_valid() and _LT_AVAILABLE:
        sess = _get_or_create_session()
        flags = lt.options_t.delete_files if remove_files else 0  # type: ignore[attr-defined]
        sess.remove_torrent(handle, flags)

    db.delete(record)
    db.commit()


def get_torrent_files(torrent_id: int) -> list[dict]:
    _ensure_lt()
    with _lock:
        handle = _handles.get(torrent_id)
    if handle is None or not handle.is_valid():
        return []
    if not handle.has_metadata():
        return []

    ti = handle.get_torrent_info()
    file_progress: list[int] = []
    try:
        file_progress = handle.file_progress()
    except Exception:
        pass

    result = []
    for i in range(ti.num_files()):
        f_size = ti.files().file_size(i)
        f_path = ti.files().file_path(i)
        fp = file_progress[i] if i < len(file_progress) else 0
        progress = round((fp / f_size * 100) if f_size > 0 else 0, 1)
        result.append({
            "index": i,
            "path": f_path,
            "size": f_size,
            "progress": progress,
        })
    return result


async def tmdb_search(query: str) -> list[TMDBResult]:
    """Search TMDB for movies matching query. Returns empty list if API key not set."""
    if not settings.TMDB_API_KEY:
        return []

    url = "https://api.themoviedb.org/3/search/movie"
    params = {
        "api_key": settings.TMDB_API_KEY,
        "query": query,
        "language": "tr-TR",
        "page": 1,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning("TMDB search failed: %s", exc)
            return []

    results: list[TMDBResult] = []
    for item in data.get("results", [])[:8]:
        year_str = item.get("release_date", "")[:4]
        year = int(year_str) if year_str.isdigit() else None
        poster = item.get("poster_path")
        results.append(TMDBResult(
            tmdb_id=item["id"],
            title=item.get("title", ""),
            original_title=item.get("original_title", ""),
            year=year,
            overview=item.get("overview", ""),
            poster_url=f"https://image.tmdb.org/t/p/w92{poster}" if poster else None,
        ))
    return results


def update_torrent_progress_from_celery() -> None:
    """Called from Celery beat task as a secondary update mechanism."""
    if not _LT_AVAILABLE:
        return
    # The background thread handles this; this is a no-op safety fallback
    pass
