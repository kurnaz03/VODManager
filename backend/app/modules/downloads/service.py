from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import decrypt_secret
from app.modules.content.models import MovieCategory, MovieContent, SeriesContent, SeriesSeason, SeriesEpisode
from app.modules.downloads.models import DownloadQueue, DownloadSourceType, DownloadStatus
from app.modules.downloads.schemas import DownloadCreate, DownloadSettingsUpdate, DownloadUpdate
from app.modules.users.models import SystemSetting


DEFAULT_MAX_CONCURRENT_DOWNLOADS = 1
DEFAULT_MAX_DOWNLOAD_SPEED_MBPS = 0.0
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original"


def _get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row is None:
        return default
    return row.value


def _set_setting(db: Session, key: str, value: str | None) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row is None:
        row = SystemSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value


def _get_download_query(db: Session):
    return db.query(DownloadQueue).options(joinedload(DownloadQueue.category), joinedload(DownloadQueue.server))


def _get_download(db: Session, download_id: int) -> DownloadQueue:
    item = _get_download_query(db).filter(DownloadQueue.id == download_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Indirme kaydi bulunamadi")
    return item


def _serialize_download(item: DownloadQueue) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "url": item.url,
        "source_type": item.source_type.value if hasattr(item.source_type, "value") else item.source_type,
        "category_id": item.category_id,
        "category_type": item.category_type,
        "category_name": item.category.name if item.category else None,
        "tmdb_id": item.tmdb_id,
        "tmdb_title": item.tmdb_title,
        "tmdb_overview": item.tmdb_overview,
        "tmdb_poster_url": item.tmdb_poster_url,
        "tmdb_backdrop_url": item.tmdb_backdrop_url,
        "tmdb_year": item.tmdb_year,
        "tmdb_rating": item.tmdb_rating,
        "resolution": item.resolution,
        "file_number": item.file_number,
        "file_path": item.file_path,
        "file_size_bytes": item.file_size_bytes,
        "status": item.status.value if hasattr(item.status, "value") else item.status,
        "progress_percent": item.progress_percent,
        "speed_mbps": item.speed_mbps,
        "eta_seconds": item.eta_seconds,
        "error_message": item.error_message,
        "vpn_client_id": item.vpn_client_id,
        "server_id": item.server_id,
        # Dizi indirmesi alanlari
        "series_id": item.series_id,
        "season_id": item.season_id,
        "episode_number": item.episode_number,
        "created_by": item.created_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _ensure_movie_category(db: Session, category_id: int) -> MovieCategory:
    category = db.query(MovieCategory).filter(MovieCategory.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Movie kategorisi bulunamadi")
    return category


def _ensure_series_season(db: Session, series_id: int, season_id: int) -> SeriesSeason:
    """Dizi indirmesi icin series ve season varligi kontrol eder."""
    series = db.query(SeriesContent).filter(SeriesContent.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dizi bulunamadi")
    season = db.query(SeriesSeason).filter(SeriesSeason.id == season_id, SeriesSeason.series_id == series_id).first()
    if season is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sezon bulunamadi")
    return season


def _detect_source_type(url: str) -> DownloadSourceType:
    normalized = url.lower()
    if "youtube.com" in normalized or "youtu.be" in normalized:
        return DownloadSourceType.youtube
    if ".m3u8" in normalized:
        return DownloadSourceType.m3u8
    return DownloadSourceType.url


def _get_next_file_number(db: Session) -> int:
    latest = db.query(func.max(DownloadQueue.file_number)).scalar()
    return int(latest or 0) + 1


def create_download(db: Session, payload: DownloadCreate, created_by: int | None) -> dict:
    print(f"CREATE_DOWNLOAD: category_type={payload.category_type}, series_id={payload.series_id}, season_id={payload.season_id}, episode_number={payload.episode_number}, category_id={payload.category_id}", flush=True)
    # category_type'a gore validasyon: film ise movie_category kontrol, dizi ise series/season kontrol
    if payload.category_type == "series":
        if not payload.series_id or not payload.season_id or not payload.episode_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dizi indirmesi icin series_id, season_id ve episode_number zorunludur",
            )
        _ensure_series_season(db, payload.series_id, payload.season_id)
    else:
        if not payload.category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Film indirmesi icin category_id zorunludur",
            )
        _ensure_movie_category(db, payload.category_id)

    source_type = _detect_source_type(str(payload.url))
    item = DownloadQueue(
        title=payload.title.strip(),
        url=str(payload.url),
        source_type=source_type,
        category_id=payload.category_id,
        category_type=payload.category_type,
        tmdb_id=payload.tmdb_id,
        tmdb_title=payload.tmdb_title.strip() if payload.tmdb_title else None,
        tmdb_overview=payload.tmdb_overview.strip() if payload.tmdb_overview else None,
        tmdb_poster_url=payload.tmdb_poster_url,
        tmdb_backdrop_url=payload.tmdb_backdrop_url,
        tmdb_year=payload.tmdb_year,
        tmdb_rating=payload.tmdb_rating,
        resolution=payload.resolution if source_type == DownloadSourceType.youtube else "auto",
        file_number=_get_next_file_number(db),
        status=DownloadStatus.queued,
        vpn_client_id=payload.vpn_client_id,
        server_id=payload.server_id,
        # Dizi alanlari – sadece category_type='series' oldugunda dolu gelir
        series_id=payload.series_id if payload.category_type == "series" else None,
        season_id=payload.season_id if payload.category_type == "series" else None,
        episode_number=payload.episode_number if payload.category_type == "series" else None,
        created_by=created_by,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_download(_get_download(db, item.id))


def list_downloads(db: Session, status_filter: str | None = None, category_id: int | None = None) -> list[dict]:
    query = _get_download_query(db).order_by(DownloadQueue.created_at.desc(), DownloadQueue.id.desc())
    if status_filter:
        try:
            query = query.filter(DownloadQueue.status == DownloadStatus(status_filter))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gecersiz indirme durumu") from exc
    if category_id is not None:
        query = query.filter(DownloadQueue.category_id == category_id)
    return [_serialize_download(item) for item in query.all()]


def get_download_detail(db: Session, download_id: int) -> dict:
    return _serialize_download(_get_download(db, download_id))


def update_download(db: Session, download_id: int, payload: DownloadUpdate) -> dict:
    item = _get_download(db, download_id)
    if item.status == DownloadStatus.downloading:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Indirme devam ederken guncellenemez")
    if payload.title is not None:
        item.title = payload.title.strip()
    if payload.category_id is not None:
        _ensure_movie_category(db, payload.category_id)
        item.category_id = payload.category_id
    if payload.tmdb_id is not None:
        item.tmdb_id = payload.tmdb_id
    if payload.tmdb_title is not None:
        item.tmdb_title = payload.tmdb_title.strip() or None
    if payload.tmdb_overview is not None:
        item.tmdb_overview = payload.tmdb_overview.strip() or None
    if payload.tmdb_poster_url is not None:
        item.tmdb_poster_url = payload.tmdb_poster_url or None
    if payload.tmdb_backdrop_url is not None:
        item.tmdb_backdrop_url = payload.tmdb_backdrop_url or None
    if payload.tmdb_year is not None:
        item.tmdb_year = payload.tmdb_year
    if payload.tmdb_rating is not None:
        item.tmdb_rating = payload.tmdb_rating
    if payload.resolution is not None and item.source_type == DownloadSourceType.youtube:
        item.resolution = payload.resolution
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_download(_get_download(db, item.id))


def delete_download(db: Session, download_id: int) -> None:
    item = _get_download(db, download_id)
    if item.status == DownloadStatus.downloading:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Once indirmeyi iptal edin")
    if item.file_path:
        file_path = Path(item.file_path)
        if file_path.exists():
            file_path.unlink()
    db.delete(item)
    db.commit()


def approve_download(db: Session, download_id: int) -> dict:
    item = _get_download(db, download_id)
    if item.status == DownloadStatus.completed:
        return _serialize_download(item)
    item.status = DownloadStatus.approved
    item.progress_percent = 0
    item.speed_mbps = None
    item.eta_seconds = None
    item.error_message = None
    db.add(item)
    db.commit()
    db.refresh(item)
    queue_approved_downloads()
    return _serialize_download(_get_download(db, item.id))


def cancel_download(db: Session, download_id: int) -> dict:
    item = _get_download(db, download_id)
    if item.status in {DownloadStatus.completed, DownloadStatus.failed, DownloadStatus.cancelled}:
        return _serialize_download(item)
    item.status = DownloadStatus.cancelled
    item.speed_mbps = None
    item.eta_seconds = None
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_download(_get_download(db, item.id))


def retry_download(db: Session, download_id: int) -> dict:
    item = _get_download(db, download_id)
    if item.status == DownloadStatus.downloading:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aktif indirme tekrar denenemez")
    item.status = DownloadStatus.approved
    item.progress_percent = 0
    item.speed_mbps = None
    item.eta_seconds = None
    item.error_message = None
    db.add(item)
    db.commit()
    db.refresh(item)
    queue_approved_downloads()
    return _serialize_download(_get_download(db, item.id))


def get_download_settings(db: Session) -> dict:
    max_concurrent = int(_get_setting(db, "downloads.max_concurrent_downloads", str(DEFAULT_MAX_CONCURRENT_DOWNLOADS)) or DEFAULT_MAX_CONCURRENT_DOWNLOADS)
    max_speed = float(_get_setting(db, "downloads.max_download_speed_mbps", str(DEFAULT_MAX_DOWNLOAD_SPEED_MBPS)) or DEFAULT_MAX_DOWNLOAD_SPEED_MBPS)
    return {
        "max_concurrent_downloads": max_concurrent,
        "max_download_speed_mbps": max_speed,
        "default_download_directory": str(settings.movies_uploads_path),
    }


def update_download_settings(db: Session, payload: DownloadSettingsUpdate) -> dict:
    _set_setting(db, "downloads.max_concurrent_downloads", str(payload.max_concurrent_downloads))
    _set_setting(db, "downloads.max_download_speed_mbps", str(payload.max_download_speed_mbps))
    db.commit()
    return get_download_settings(db)


def _get_tmdb_credentials(db: Session) -> tuple[str, str]:
    encrypted_api_key = _get_setting(db, "tmdb.api_key")
    if not encrypted_api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TMDB API key kaydedilmemis")
    language = _get_setting(db, "tmdb.language", "tr-TR") or "tr-TR"
    return decrypt_secret(encrypted_api_key), language


def _tmdb_image_url(path: str | None, backdrop: bool = False) -> str | None:
    if not path:
        return None
    base = TMDB_BACKDROP_BASE_URL if backdrop else TMDB_IMAGE_BASE_URL
    return f"{base}{path}"


def search_tmdb_movies(db: Session, query: str) -> list[dict]:
    if not query.strip():
        return []
    api_key, language = _get_tmdb_credentials(db)
    try:
        with httpx.Client(base_url=TMDB_BASE_URL, timeout=20.0) as client:
            response = client.get(
                "/search/movie",
                params={"api_key": api_key, "language": language, "query": query.strip(), "page": 1},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"TMDB arama hatasi: {exc}") from exc

    results = []
    for item in (data.get("results") or [])[:10]:
        release_date = item.get("release_date") or ""
        results.append(
            {
                "id": item["id"],
                "title": item.get("title") or item.get("name") or "Bilinmeyen",
                "overview": item.get("overview"),
                "poster_url": _tmdb_image_url(item.get("poster_path")),
                "backdrop_url": _tmdb_image_url(item.get("backdrop_path"), backdrop=True),
                "release_year": int(release_date[:4]) if len(release_date) >= 4 and release_date[:4].isdigit() else None,
                "rating": item.get("vote_average"),
            }
        )
    return results


def get_tmdb_movie_detail(db: Session, tmdb_id: int) -> dict:
    api_key, language = _get_tmdb_credentials(db)
    try:
        with httpx.Client(base_url=TMDB_BASE_URL, timeout=20.0) as client:
            response = client.get(f"/movie/{tmdb_id}", params={"api_key": api_key, "language": language})
            response.raise_for_status()
            item = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"TMDB detay hatasi: {exc}") from exc

    release_date = item.get("release_date") or ""
    return {
        "id": item["id"],
        "title": item.get("title") or "Bilinmeyen",
        "overview": item.get("overview"),
        "poster_url": _tmdb_image_url(item.get("poster_path")),
        "backdrop_url": _tmdb_image_url(item.get("backdrop_path"), backdrop=True),
        "release_year": int(release_date[:4]) if len(release_date) >= 4 and release_date[:4].isdigit() else None,
        "rating": item.get("vote_average"),
    }


def search_tmdb_tv(db: Session, query: str) -> list[dict]:
    if not query.strip():
        return []
    api_key, language = _get_tmdb_credentials(db)
    try:
        with httpx.Client(base_url=TMDB_BASE_URL, timeout=20.0) as client:
            response = client.get(
                "/search/tv",
                params={"api_key": api_key, "language": language, "query": query.strip(), "page": 1},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"TMDB dizi arama hatasi: {exc}") from exc

    results = []
    for item in (data.get("results") or [])[:10]:
        first_air_date = item.get("first_air_date") or ""
        results.append(
            {
                "id": item["id"],
                "title": item.get("name") or item.get("original_name") or "Bilinmeyen",
                "overview": item.get("overview"),
                "poster_url": _tmdb_image_url(item.get("poster_path")),
                "backdrop_url": _tmdb_image_url(item.get("backdrop_path"), backdrop=True),
                "first_air_year": int(first_air_date[:4]) if len(first_air_date) >= 4 and first_air_date[:4].isdigit() else None,
                "rating": item.get("vote_average"),
            }
        )
    return results


def get_tmdb_tv_detail(db: Session, tmdb_id: int) -> dict:
    api_key, language = _get_tmdb_credentials(db)
    try:
        with httpx.Client(base_url=TMDB_BASE_URL, timeout=20.0) as client:
            response = client.get(f"/tv/{tmdb_id}", params={"api_key": api_key, "language": language})
            response.raise_for_status()
            item = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"TMDB dizi detay hatasi: {exc}") from exc

    first_air_date = item.get("first_air_date") or ""
    genres = [g["name"] for g in (item.get("genres") or []) if g.get("name")]
    return {
        "id": item["id"],
        "title": item.get("name") or item.get("original_name") or "Bilinmeyen",
        "overview": item.get("overview"),
        "poster_url": _tmdb_image_url(item.get("poster_path")),
        "backdrop_url": _tmdb_image_url(item.get("backdrop_path"), backdrop=True),
        "first_air_year": int(first_air_date[:4]) if len(first_air_date) >= 4 and first_air_date[:4].isdigit() else None,
        "rating": item.get("vote_average"),
        "number_of_seasons": item.get("number_of_seasons"),
        "genres": genres,
    }


def clear_downloads(db: Session) -> dict:
    clearable_statuses = {DownloadStatus.completed, DownloadStatus.failed, DownloadStatus.cancelled}
    items = db.query(DownloadQueue).filter(DownloadQueue.status.in_(clearable_statuses)).all()
    count = len(items)
    for item in items:
        db.delete(item)
    db.commit()
    return {"deleted": count}


def queue_approved_downloads() -> int:
    db = SessionLocal()
    try:
        settings_payload = get_download_settings(db)
        max_concurrent = settings_payload["max_concurrent_downloads"]
        active_count = db.query(DownloadQueue).filter(DownloadQueue.status == DownloadStatus.downloading).count()
        available_slots = max(max_concurrent - active_count, 0)
        if available_slots == 0:
            return 0

        approved_items = (
            db.query(DownloadQueue)
            .filter(DownloadQueue.status == DownloadStatus.approved)
            .order_by(DownloadQueue.created_at.asc(), DownloadQueue.id.asc())
            .limit(available_slots)
            .all()
        )
        if not approved_items:
            return 0

        from app.modules.downloads.tasks import run_download_job

        for item in approved_items:
            item.status = DownloadStatus.downloading
            item.error_message = None
            item.speed_mbps = None
            item.eta_seconds = None
            db.add(item)
            db.commit()
            run_download_job.delay(item.id)

        return len(approved_items)
    finally:
        db.close()


def _build_output_template(item: DownloadQueue) -> Path:
    # Dizi modunda series_id bazli klasor, film modunda category_id bazli klasor
    if item.category_type == "series" and item.series_id:
        target_directory = settings.movies_uploads_path / f"series_{item.series_id}"
    else:
        target_directory = settings.movies_uploads_path / str(item.category_id)
    target_directory.mkdir(parents=True, exist_ok=True)
    return target_directory / f"{item.id:05d}.%(ext)s"


def _get_tun0_address() -> str | None:
    """Return the IPv4 address of the tun0 interface, or None if unavailable."""
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


def _build_download_command(item: DownloadQueue, max_download_speed_mbps: float) -> list[str]:
    output_template = _build_output_template(item)
    command = [
        "yt-dlp",
        "--newline",
        "--progress",
        "--no-warnings",
        "--restrict-filenames",
        "--merge-output-format",
        "mp4",
        "--ppa", "Merger+ffmpeg_o:-movflags +faststart",
        "-o",
        str(output_template),
    ]

    if max_download_speed_mbps > 0:
        command.extend(["--limit-rate", f"{max_download_speed_mbps}M"])

    if item.source_type == DownloadSourceType.youtube:
        if item.resolution == "2160":
            command.extend(["-f", "bestvideo[height<=2160][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=2160][vcodec^=avc1]+bestaudio/bestvideo[height<=2160]+bestaudio[acodec^=mp4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]/best"])
        elif item.resolution == "1080":
            command.extend(["-f", "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080][vcodec^=avc1]+bestaudio/bestvideo[height<=1080]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"])
        elif item.resolution == "720":
            command.extend(["-f", "bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][vcodec^=avc1]+bestaudio/bestvideo[height<=720]+bestaudio[acodec^=mp4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"])
        else:
            command.extend(["-f", "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1]+bestaudio/bestvideo+bestaudio[acodec^=mp4a]/bestvideo+bestaudio/best"])
        cookies_path = settings.youtube_cookies_path
        if cookies_path.exists() and cookies_path.stat().st_size > 0:
            command.extend(["--cookies", str(cookies_path)])

    if item.vpn_client_id:
        tun0_ip = _get_tun0_address()
        if tun0_ip:
            command.extend(["--source-address", tun0_ip])

    command.append(item.url)
    return command


def _parse_speed_to_mbps(raw_speed: str | None) -> float | None:
    if not raw_speed:
        return None
    match = re.match(r"(?P<value>[0-9.]+)(?P<unit>[KMG]?i?B/s|B/s)", raw_speed)
    if not match:
        return None
    value = float(match.group("value"))
    unit = match.group("unit")
    if unit == "B/s":
        return value / 1_000_000
    if unit in {"KiB/s", "KB/s"}:
        return value / 1024
    if unit in {"MiB/s", "MB/s"}:
        return value
    if unit in {"GiB/s", "GB/s"}:
        return value * 1024
    return value


def _parse_eta_to_seconds(raw_eta: str | None) -> int | None:
    if not raw_eta:
        return None
    parts = [int(part) for part in raw_eta.split(":")]
    if len(parts) == 2:
        minutes, seconds = parts
        return minutes * 60 + seconds
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return hours * 3600 + minutes * 60 + seconds
    return None


def _update_progress(db: Session, item: DownloadQueue, line: str) -> None:
    percent_match = re.search(r"(?P<percent>\d+(?:\.\d+)?)%", line)
    speed_match = re.search(r"at\s+(?P<speed>[0-9.]+[KMG]?i?B/s|[0-9.]+B/s)", line)
    eta_match = re.search(r"ETA\s+(?P<eta>\d{2}:\d{2}(?::\d{2})?)", line)
    changed = False
    if percent_match:
        item.progress_percent = max(0, min(int(float(percent_match.group("percent"))), 100))
        changed = True
    speed = _parse_speed_to_mbps(speed_match.group("speed") if speed_match else None)
    if speed is not None:
        item.speed_mbps = round(speed, 2)
        changed = True
    eta_seconds = _parse_eta_to_seconds(eta_match.group("eta") if eta_match else None)
    if eta_seconds is not None:
        item.eta_seconds = eta_seconds
        changed = True
    if changed:
        db.add(item)
        db.commit()
        db.refresh(item)


def _finalize_completed_download(db: Session, item: DownloadQueue) -> None:
    # Dizi modunda series_id bazli klasor, film modunda category_id bazli klasor
    if item.category_type == "series" and item.series_id:
        output_directory = settings.movies_uploads_path / f"series_{item.series_id}"
    else:
        output_directory = settings.movies_uploads_path / str(item.category_id)
    candidates = sorted(output_directory.glob(f"{item.id:05d}.*"))
    output_file = candidates[0] if candidates else None
    if output_file is None:
        raise RuntimeError("Indirilen dosya bulunamadi")

    # MP4 dosyalara faststart uygula (moov atom'u basa tası - IPTV uyumluluğu)
    if output_file.suffix.lower() == ".mp4":
        tmp_file = output_file.with_suffix(".faststart.mp4")
        try:
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(output_file), "-c", "copy", "-movflags", "+faststart", str(tmp_file)],
                capture_output=True,
                timeout=300,
            )
            if result.returncode == 0 and tmp_file.exists():
                tmp_file.replace(output_file)
        except Exception:
            if tmp_file.exists():
                tmp_file.unlink()

    item.file_path = str(output_file)
    item.file_size_bytes = output_file.stat().st_size
    item.progress_percent = 100
    item.speed_mbps = None
    item.eta_seconds = None
    item.error_message = None
    item.status = DownloadStatus.completed
    db.add(item)
    db.commit()

    # Film indirmesi: MovieContent olarak kaydet
    if item.category_type == "movies":
        existing = db.query(MovieContent).filter(MovieContent.download_queue_id == item.id).first()
        if existing is None:
            movie = MovieContent(
                title=item.tmdb_title or item.title,
                description=item.tmdb_overview,
                category_id=item.category_id,
                tmdb_id=item.tmdb_id,
                poster_url=item.tmdb_poster_url,
                backdrop_url=item.tmdb_backdrop_url,
                release_year=item.tmdb_year,
                rating=item.tmdb_rating,
                resolution=item.resolution,
                file_path=item.file_path,
                file_size_bytes=item.file_size_bytes,
                source_url=item.url,
                is_public=True,
                download_queue_id=item.id,
                server_id=item.server_id,
            )
            db.add(movie)
            db.commit()

    # Dizi indirmesi: SeriesEpisode olarak kaydet veya guncelle
    elif item.category_type == "series" and item.season_id and item.episode_number:
        existing_ep = (
            db.query(SeriesEpisode)
            .filter(
                SeriesEpisode.season_id == item.season_id,
                SeriesEpisode.episode_number == item.episode_number,
            )
            .first()
        )
        if existing_ep:
            # Mevcut bolumu guncelle – dosya yolunu ve kaynak URL'i yaz
            existing_ep.file_path = item.file_path
            existing_ep.source_url = item.url
            if item.title:
                existing_ep.title = item.tmdb_title or item.title
            db.add(existing_ep)
        else:
            # Yeni bolum olustur
            episode = SeriesEpisode(
                season_id=item.season_id,
                episode_number=item.episode_number,
                title=item.tmdb_title or item.title,
                file_path=item.file_path,
                source_url=item.url,
            )
            db.add(episode)
        db.commit()

        # Dizinin server_id'sini guncelle (tum bolumler ayni sunucuda varsayimi)
        series = db.query(SeriesContent).filter(SeriesContent.id == item.series_id).first()
        if series and item.server_id:
            series.server_id = item.server_id
            db.add(series)
            db.commit()


def process_download(download_id: int) -> None:
    db = SessionLocal()
    try:
        item = _get_download(db, download_id)
        if item.status != DownloadStatus.downloading:
            return

        settings_payload = get_download_settings(db)
        command = _build_download_command(item, settings_payload["max_download_speed_mbps"])
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
        except FileNotFoundError as exc:
            item.status = DownloadStatus.failed
            item.error_message = "yt-dlp bulunamadi"
            db.add(item)
            db.commit()
            raise RuntimeError("yt-dlp bulunamadi") from exc

        captured_lines: list[str] = []
        cancelled = False
        assert process.stdout is not None
        for raw_line in process.stdout:
            line = raw_line.strip()
            if line:
                captured_lines.append(line)
                _update_progress(db, item, line)

            db.expire_all()
            latest = _get_download(db, download_id)
            item = latest
            if latest.status == DownloadStatus.cancelled:
                cancelled = True
                process.terminate()
                break

        return_code = process.wait()
        if cancelled:
            item.status = DownloadStatus.cancelled
            item.speed_mbps = None
            item.eta_seconds = None
            db.add(item)
            db.commit()
            return

        if return_code != 0:
            item.status = DownloadStatus.failed
            item.error_message = captured_lines[-1] if captured_lines else "Indirme basarisiz oldu"
            item.speed_mbps = None
            item.eta_seconds = None
            db.add(item)
            db.commit()
            return

        _finalize_completed_download(db, item)
    except Exception as exc:
        db.rollback()
        try:
            item = _get_download(db, download_id)
            if item.status == DownloadStatus.downloading:
                item.status = DownloadStatus.failed
                item.speed_mbps = None
                item.eta_seconds = None
                item.error_message = str(exc)
                db.add(item)
                db.commit()
        except Exception:
            db.rollback()
        raise
    finally:
        db.close()
        queue_approved_downloads()