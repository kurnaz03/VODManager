import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse, StreamingResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.modules.content.models import (
    Bouquet, BouquetItem, BouquetItemType, MovieContent, SeriesContent,
    SeriesEpisode, SeriesSeason, TvContent,
)
from app.modules.iptv_users.models import IptvUser, UserBouquet
from app.modules.playlist.models import Playlist
from app.modules.connections import service as conn_svc
from app.modules.tv.models import TvChannel, TvChannelBouquet
from app.modules.tv import stream_service as tv_stream
from app.modules.tv.viewer_tracker import viewer_tracker

from app.core.config import settings
from app.modules.content.models import MusicPlaylist, RadioContent

from app.modules.servers.models import Server, ServerType

router = APIRouter()

# Module-level async HTTP client for connection pooling
_http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)

HLS_BASE_DIR = "/var/www/vod-manager/shared/hls"


def _server_host(db: Session | None = None) -> str:
    """Return server host for M3U/stream URLs.
    
    Priority:
    1. Main server's domain_name if set
    2. settings.MAIN_SERVER_IP as fallback
    """
    if db is not None:
        try:
            main_server = db.query(Server).filter(Server.server_type == ServerType.main).first()
            if main_server and main_server.domain_name:
                return main_server.domain_name
        except Exception:
            pass
    return settings.MAIN_SERVER_IP


def _server_port() -> int:
    return settings.SERVER_PORT


def _get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "0.0.0.0"


def _do_checks_and_record(
    db: Session,
    user: IptvUser,
    request: Request,
    stream_id: int,
    stream_type: str,
    stream_name: str | None = None,
) -> None:
    ip = _get_client_ip(request)
    ua = request.headers.get("user-agent")
    geo = conn_svc.get_geo_info(ip)
    conn_svc.check_restrictions(db, user, ip, geo)
    conn_svc.check_max_connections(db, user)
    conn_svc.record_connection(
        db=db, user=user, ip=ip, geo=geo,
        stream_id=stream_id, stream_type=stream_type,
        user_agent=ua, stream_name=stream_name,
    )


def _auth_iptv_user(db: Session, username: str, password: str) -> IptvUser:
    user = (
        db.query(IptvUser)
        .options(joinedload(IptvUser.bouquets))
        .filter(IptvUser.username == username, IptvUser.password == password)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gecersiz kimlik")
    if not user.is_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap pasif")
    if user.expiry_date:
        exp = user.expiry_date
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Suresi dolmus")
    return user


def _check_item_access(db: Session, user: IptvUser, item_type: str, item_id: int) -> bool:
    bouquet_ids = [ub.bouquet_id for ub in (user.bouquets or [])]
    if not bouquet_ids:
        return True
    try:
        it = BouquetItemType(item_type)
    except ValueError:
        return False
    exists = (
        db.query(BouquetItem)
        .filter(
            BouquetItem.bouquet_id.in_(bouquet_ids),
            BouquetItem.item_type == it,
            BouquetItem.item_id == item_id,
        )
        .first()
    )
    return exists is not None


def _build_user_info(user: IptvUser) -> dict:
    exp_date = "9999999999"
    if user.expiry_date:
        exp = user.expiry_date
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        exp_date = str(int(exp.timestamp()))
    created = str(int(user.created_at.timestamp())) if user.created_at else "0"
    return {
        "username": user.username,
        "password": user.password,
        "message": "Welcome",
        "auth": 1,
        "status": "Active",
        "exp_date": exp_date,
        "is_trial": "1" if user.is_trial else "0",
        "active_cons": str(user.max_connections or 1),
        "created_at": created,
        "max_connections": str(user.max_connections or 1),
        "allowed_output_formats": ["m3u8", "ts", "rtmp"],
    }


def _build_server_info(db: Session | None = None) -> dict:
    now = datetime.now()
    return {
        "url": _server_host(db),
        "port": str(_server_port()),
        "https_port": "443",
        "server_protocol": "http",
        "rtmp_port": "1935",
        "timezone": "Europe/Istanbul",
        "timestamp_now": int(now.timestamp()),
        "time_now": now.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _get_user_bouquet_ids(user: IptvUser, db: Session) -> list[int]:
    return [ub.bouquet_id for ub in (user.bouquets or [])]


@router.get("/player_api.php", tags=["stream"])
def player_api(
    username: str = Query(...),
    password: str = Query(...),
    action: str = Query(None),
    series_id: int = Query(None),
    vod_id: int = Query(None),
    db: Session = Depends(get_db),
):
    user = _auth_iptv_user(db, username, password)
    bouquet_ids = _get_user_bouquet_ids(user, db)

    # No action -> user info + server info
    if not action:
        return JSONResponse({
            "user_info": _build_user_info(user),
            "server_info": _build_server_info(db),
        })

    # ── Categories ────────────────────────────────────────────────────────────
    if action in ("get_live_categories", "get_vod_categories", "get_series_categories"):
        if not bouquet_ids:
            bouquets = db.query(Bouquet).filter(Bouquet.is_active == True).all()
        else:
            bouquets = db.query(Bouquet).filter(Bouquet.id.in_(bouquet_ids), Bouquet.is_active == True).all()
        result = [
            {"category_id": str(b.id), "category_name": b.name, "parent_id": 0}
            for b in bouquets
        ]
        if not result:
            result = [{"category_id": "1", "category_name": "All", "parent_id": 0}]
        return JSONResponse(result)

    # ── Live streams ──────────────────────────────────────────────────────────
    if action == "get_live_streams":
        result = []
        idx = 1
        if bouquet_ids:
            tv_items = (
                db.query(TvChannelBouquet)
                .filter(TvChannelBouquet.bouquet_id.in_(bouquet_ids))
                .order_by(TvChannelBouquet.bouquet_id.asc(), TvChannelBouquet.position.asc())
                .all()
            )
            for tbi in tv_items:
                ch = db.query(TvChannel).filter(TvChannel.id == tbi.tv_channel_id, TvChannel.is_active == True).first()
                if ch is None:
                    continue
                result.append({
                    "num": idx,
                    "name": ch.name,
                    "stream_type": "live",
                    "stream_id": ch.id,
                    "stream_icon": ch.logo_url or "",
                    "epg_channel_id": ch.epg_channel_id or str(ch.id),
                    "added": "0",
                    "category_id": str(tbi.bouquet_id),
                    "custom_sid": "",
                    "tv_archive": 0,
                    "direct_source": "",
                    "tv_archive_duration": 0,
                })
                idx += 1
        if not result:
            channels = db.query(TvChannel).filter(TvChannel.is_active == True).all()
            for ch in channels:
                result.append({
                    "num": idx,
                    "name": ch.name,
                    "stream_type": "live",
                    "stream_id": ch.id,
                    "stream_icon": ch.logo_url or "",
                    "epg_channel_id": ch.epg_channel_id or str(ch.id),
                    "added": "0",
                    "category_id": "1",
                    "custom_sid": "",
                    "tv_archive": 0,
                    "direct_source": "",
                    "tv_archive_duration": 0,
                })
                idx += 1
        return JSONResponse(result)

    # ── VOD streams ───────────────────────────────────────────────────────────
    if action == "get_vod_streams":
        result = []
        idx = 1
        if bouquet_ids:
            items = (
                db.query(BouquetItem)
                .filter(
                    BouquetItem.bouquet_id.in_(bouquet_ids),
                    BouquetItem.item_type == BouquetItemType.movie,
                )
                .order_by(BouquetItem.bouquet_id.asc(), BouquetItem.position.asc())
                .all()
            )
            for item in items:
                movie = db.query(MovieContent).filter(MovieContent.id == item.item_id).first()
                if movie is None:
                    continue
                result.append({
                    "num": idx,
                    "name": movie.title,
                    "stream_type": "movie",
                    "stream_id": movie.id,
                    "stream_icon": movie.poster_url or "",
                    "rating": str(movie.rating or ""),
                    "added": "0",
                    "category_id": str(item.bouquet_id),
                    "container_extension": "mp4",
                    "custom_sid": "",
                    "direct_source": "",
                })
                idx += 1
        if not result:
            movies = db.query(MovieContent).all()
            for movie in movies:
                result.append({
                    "num": idx,
                    "name": movie.title,
                    "stream_type": "movie",
                    "stream_id": movie.id,
                    "stream_icon": movie.poster_url or "",
                    "rating": str(movie.rating or ""),
                    "added": "0",
                    "category_id": str(movie.category_id or "1"),
                    "container_extension": "mp4",
                    "custom_sid": "",
                    "direct_source": "",
                })
                idx += 1
        return JSONResponse(result)

    # ── Series list ───────────────────────────────────────────────────────────
    if action == "get_series":
        result = []
        idx = 1
        if bouquet_ids:
            items = (
                db.query(BouquetItem)
                .filter(
                    BouquetItem.bouquet_id.in_(bouquet_ids),
                    BouquetItem.item_type == BouquetItemType.series,
                )
                .order_by(BouquetItem.bouquet_id.asc(), BouquetItem.position.asc())
                .all()
            )
            for item in items:
                series = db.query(SeriesContent).filter(SeriesContent.id == item.item_id).first()
                if series is None:
                    continue
                result.append({
                    "num": idx,
                    "name": series.title,
                    "series_id": series.id,
                    "cover": series.poster_url or "",
                    "plot": series.description or "",
                    "cast": "",
                    "director": "",
                    "genre": "",
                    "releaseDate": str(series.release_year or ""),
                    "last_modified": "",
                    "rating": str(series.rating or ""),
                    "category_id": str(item.bouquet_id),
                    "backdrop_path": [series.backdrop_url] if series.backdrop_url else [],
                })
                idx += 1
        if not result:
            all_series = db.query(SeriesContent).all()
            for series in all_series:
                result.append({
                    "num": idx,
                    "name": series.title,
                    "series_id": series.id,
                    "cover": series.poster_url or "",
                    "plot": series.description or "",
                    "cast": "",
                    "director": "",
                    "genre": "",
                    "releaseDate": str(series.release_year or ""),
                    "last_modified": "",
                    "rating": str(series.rating or ""),
                    "category_id": str(series.category_id or "1"),
                    "backdrop_path": [series.backdrop_url] if series.backdrop_url else [],
                })
                idx += 1
        return JSONResponse(result)

    # ── Series info ───────────────────────────────────────────────────────────
    if action == "get_series_info":
        if series_id is None:
            raise HTTPException(status_code=400, detail="series_id required")
        series = db.query(SeriesContent).filter(SeriesContent.id == series_id).first()
        if series is None:
            raise HTTPException(status_code=404, detail="Series not found")
        seasons = (
            db.query(SeriesSeason)
            .filter(SeriesSeason.series_id == series_id)
            .order_by(SeriesSeason.season_number.asc())
            .all()
        )
        seasons_info = [
            {
                "season_number": s.season_number,
                "name": f"Season {s.season_number}",
                "episode_count": len(s.episodes),
            }
            for s in seasons
        ]
        info = {
            "name": series.title,
            "cover": series.poster_url or "",
            "plot": series.description or "",
            "cast": "",
            "director": "",
            "genre": "",
            "releaseDate": str(series.release_year or ""),
            "rating": str(series.rating or ""),
            "backdrop_path": [series.backdrop_url] if series.backdrop_url else [],
        }
        episodes_by_season: dict = {}
        for season in seasons:
            eps = (
                db.query(SeriesEpisode)
                .filter(SeriesEpisode.season_id == season.id)
                .order_by(SeriesEpisode.episode_number.asc())
                .all()
            )
            episodes_by_season[str(season.season_number)] = [
                {
                    "id": str(ep.id),
                    "episode_num": ep.episode_number,
                    "title": ep.title or f"Episode {ep.episode_number}",
                    "container_extension": "mp4",
                    "info": {"duration_secs": 0, "duration": ""},
                    "custom_sid": "",
                    "added": "",
                    "season": season.season_number,
                    "direct_source": "",
                }
                for ep in eps
            ]
        return JSONResponse({
            "seasons": seasons_info,
            "info": info,
            "episodes": episodes_by_season,
        })

    # ── VOD info ──────────────────────────────────────────────────────────────
    if action == "get_vod_info":
        if vod_id is None:
            raise HTTPException(status_code=400, detail="vod_id required")
        movie = db.query(MovieContent).filter(MovieContent.id == vod_id).first()
        if movie is None:
            raise HTTPException(status_code=404, detail="Movie not found")
        return JSONResponse({
            "info": {
                "tmdb_id": movie.tmdb_id,
                "name": movie.title,
                "o_name": movie.title,
                "cover_big": movie.poster_url or "",
                "movie_image": movie.poster_url or "",
                "releasedate": str(movie.release_year or ""),
                "rating": str(movie.rating or ""),
                "description": movie.description or "",
                "cast": "",
                "director": "",
                "genre": "",
                "backdrop_path": [movie.backdrop_url] if movie.backdrop_url else [],
                "duration_secs": 0,
                "duration": "",
                "bitrate": movie.audio_bitrate or 0,
                "video": {"width": 0, "height": 0, "codec": ""},
                "audio": {"codec": "", "bitrate": ""},
            },
            "movie_data": {
                "stream_id": movie.id,
                "name": movie.title,
                "added": "0",
                "category_id": str(movie.category_id or ""),
                "container_extension": "mp4",
                "custom_sid": "",
                "direct_source": "",
            },
        })

    raise HTTPException(status_code=400, detail=f"Unknown action: {action}")


@router.get("/panel_api.php", tags=["stream"])
def panel_api(
    username: str = Query(...),
    password: str = Query(...),
    db: Session = Depends(get_db),
):
    user = _auth_iptv_user(db, username, password)
    bouquet_ids = _get_user_bouquet_ids(user, db)

    # Build available_channels list (live streams)
    available_channels = []
    if bouquet_ids:
        tv_items = (
            db.query(TvChannelBouquet)
            .filter(TvChannelBouquet.bouquet_id.in_(bouquet_ids))
            .order_by(TvChannelBouquet.position.asc())
            .all()
        )
        for tbi in tv_items:
            ch = db.query(TvChannel).filter(TvChannel.id == tbi.tv_channel_id, TvChannel.is_active == True).first()
            if ch is None:
                continue
            available_channels.append({
                "stream_id": ch.id,
                "name": ch.name,
                "stream_icon": ch.logo_url or "",
                "epg_channel_id": ch.epg_channel_id or str(ch.id),
                "category_id": str(tbi.bouquet_id),
            })

    return JSONResponse({
        "user_info": _build_user_info(user),
        "server_info": _build_server_info(db),
        "available_channels": available_channels,
    })


@router.get("/get.php", response_class=PlainTextResponse, tags=["stream"])
def get_m3u_plus(
    username: str = Query(...),
    password: str = Query(...),
    type: str = Query("m3u_plus"),
    output: str = Query("mpegts"),
    db: Session = Depends(get_db),
):
    user = _auth_iptv_user(db, username, password)
    base = f"http://{_server_host(db)}:{_server_port()}"
    lines = ["#EXTM3U"]

    for ub in (user.bouquets or []):
        bouquet = (
            db.query(Bouquet)
            .options(joinedload(Bouquet.items))
            .filter(Bouquet.id == ub.bouquet_id)
            .first()
        )
        if not bouquet or not bouquet.is_active:
            continue

        items = sorted(bouquet.items, key=lambda x: (x.position, x.id))
        for item in items:
            item_type = item.item_type.value if hasattr(item.item_type, "value") else str(item.item_type)

            from app.modules.content.service import _get_item_metadata
            title, logo = _get_item_metadata(db, item_type, item.item_id)
            # Gercekte var olmayan item'leri atla (orphan)
            if title is None:
                continue
            title = title or f"Item {item.item_id}"
            logo = logo or ""

            if item_type == "tv":
                stream_url = f"{base}/live/{username}/{password}/{item.item_id}.ts"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)
            elif item_type == "movie":
                stream_url = f"{base}/movie/{username}/{password}/{item.item_id}.mp4"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)
            elif item_type == "series":
                # Emit one entry per episode that has a file or source URL
                series_obj = db.query(SeriesContent).filter(SeriesContent.id == item.item_id).first()
                if series_obj:
                    seasons = (
                        db.query(SeriesSeason)
                        .filter(SeriesSeason.series_id == series_obj.id)
                        .order_by(SeriesSeason.season_number.asc())
                        .all()
                    )
                    emitted = False
                    for season in seasons:
                        episodes = (
                            db.query(SeriesEpisode)
                            .filter(
                                SeriesEpisode.season_id == season.id,
                                or_(
                                    SeriesEpisode.source_url.isnot(None),
                                    SeriesEpisode.file_path.isnot(None),
                                ),
                            )
                            .order_by(SeriesEpisode.episode_number.asc())
                            .all()
                        )
                        for ep in episodes:
                            # Skip episodes with empty-string file_path and no source_url
                            has_file = ep.file_path and ep.file_path.strip() != ""
                            has_url = ep.source_url and ep.source_url.strip() != ""
                            if not has_file and not has_url:
                                continue
                            sn = season.season_number or 0
                            en = ep.episode_number or 0
                            ep_label = f"{title} S{sn:02d}E{en:02d}"
                            ep_extinf = (
                                f'#EXTINF:-1 tvg-id="{ep.id}" tvg-name="{ep_label}" '
                                f'tvg-logo="{logo}" group-title="{bouquet.name}",{ep_label}'
                            )
                            lines.append(ep_extinf)
                            lines.append(f"{base}/series/{username}/{password}/{ep.id}.mp4")
                            emitted = True
                    if not emitted:
                        # Fallback: single series-level URL if no episodes found
                        extinf = (
                            f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                            f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
                        )
                        lines.append(extinf)
                        lines.append(f"{base}/series/{username}/{password}/{item.item_id}.mp4")
            elif item_type == "vod_channel":
                stream_url = f"{base}/live/{username}/{password}/{item.item_id}.m3u8"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)
            elif item_type == "radio":
                channel = (
                    db.query(RadioContent)
                    .options(joinedload(RadioContent.category))
                    .filter(RadioContent.id == item.item_id)
                    .first()
                )
                group = channel.category.name if channel and channel.category else bouquet.name
                stream_url = f"{base}/live/radio/{username}/{password}/{item.item_id}.m3u8"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{group}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)
            elif item_type == "music_playlist":
                pl = (
                    db.query(MusicPlaylist)
                    .options(joinedload(MusicPlaylist.category))
                    .filter(MusicPlaylist.id == item.item_id)
                    .first()
                )
                group = pl.category.name if pl and pl.category else bouquet.name
                stream_url = f"{base}/radio/{username}/{password}/{item.item_id}.m3u8"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{group}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)
            else:
                stream_url = f"{base}/live/{username}/{password}/{item.item_id}.ts"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                    f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
                )
                lines.append(extinf)
                lines.append(stream_url)

    # TV Channels (from tv_channel_bouquets)
    bouquet_ids = [ub.bouquet_id for ub in (user.bouquets or [])]
    tv_lines_added = False
    if bouquet_ids:
        tv_bouquet_items = (
            db.query(TvChannelBouquet)
            .filter(TvChannelBouquet.bouquet_id.in_(bouquet_ids))
            .order_by(TvChannelBouquet.position.asc())
            .all()
        )
        for tbi in tv_bouquet_items:
            ch = db.query(TvChannel).filter(TvChannel.id == tbi.tv_channel_id, TvChannel.is_active == True).first()
            if ch is None:
                continue
            bq = db.query(Bouquet).filter(Bouquet.id == tbi.bouquet_id).first()
            group = bq.name if bq else "TV"
            logo = ch.logo_url or ""
            epg_id = ch.epg_channel_id or ch.id
            stream_url = f"{base}/live/tv/{username}/{password}/{ch.id}.ts"
            extinf = (
                f'#EXTINF:-1 tvg-id="{epg_id}" tvg-name="{ch.name}" '
                f'tvg-logo="{logo}" group-title="{group}",{ch.name}'
            )
            lines.append(extinf)
            lines.append(stream_url)
            tv_lines_added = True

    # Fallback: no bouquets or empty tv_channel_bouquets -> add all content
    if not bouquet_ids or (len(lines) <= 1):
        # TV channels fallback
        if not tv_lines_added:
            channels = db.query(TvChannel).filter(TvChannel.is_active == True).all()
            for ch in channels:
                logo = ch.logo_url or ""
                epg_id = ch.epg_channel_id or ch.id
                stream_url = f"{base}/live/tv/{username}/{password}/{ch.id}.ts"
                extinf = (
                    f'#EXTINF:-1 tvg-id="{epg_id}" tvg-name="{ch.name}" '
                    f'tvg-logo="{logo}" group-title="TV",{ch.name}'
                )
                lines.append(extinf)
                lines.append(stream_url)
        # Movies fallback
        movies = db.query(MovieContent).all()
        for movie in movies:
            logo = movie.poster_url or ""
            stream_url = f"{base}/movie/{username}/{password}/{movie.id}.mp4"
            extinf = (
                f'#EXTINF:-1 tvg-id="{movie.id}" tvg-name="{movie.title}" '
                f'tvg-logo="{logo}" group-title="Movies",{movie.title}'
            )
            lines.append(extinf)
            lines.append(stream_url)
        # Series fallback
        all_series = db.query(SeriesContent).all()
        for series_obj in all_series:
            logo = series_obj.poster_url or ""
            seasons = (
                db.query(SeriesSeason)
                .filter(SeriesSeason.series_id == series_obj.id)
                .order_by(SeriesSeason.season_number.asc())
                .all()
            )
            emitted = False
            for season in seasons:
                episodes = (
                    db.query(SeriesEpisode)
                    .filter(
                        SeriesEpisode.season_id == season.id,
                        or_(
                            SeriesEpisode.source_url.isnot(None),
                            SeriesEpisode.file_path.isnot(None),
                        ),
                    )
                    .order_by(SeriesEpisode.episode_number.asc())
                    .all()
                )
                for ep in episodes:
                    has_file = ep.file_path and ep.file_path.strip() != ""
                    has_url = ep.source_url and ep.source_url.strip() != ""
                    if not has_file and not has_url:
                        continue
                    sn = season.season_number or 0
                    en = ep.episode_number or 0
                    ep_label = f"{series_obj.title} S{sn:02d}E{en:02d}"
                    ep_extinf = (
                        f'#EXTINF:-1 tvg-id="{ep.id}" tvg-name="{ep_label}" '
                        f'tvg-logo="{logo}" group-title="Series",{ep_label}'
                    )
                    lines.append(ep_extinf)
                    lines.append(f"{base}/series/{username}/{password}/{ep.id}.mp4")
                    emitted = True
            if not emitted:
                extinf = (
                    f'#EXTINF:-1 tvg-id="{series_obj.id}" tvg-name="{series_obj.title}" '
                    f'tvg-logo="{logo}" group-title="Series",{series_obj.title}'
                )
                lines.append(extinf)
                lines.append(f"{base}/series/{username}/{password}/{series_obj.id}.mp4")
        # Radio fallback
        radios = db.query(RadioContent).options(joinedload(RadioContent.category)).all()
        for radio in radios:
            logo = radio.logo_url or ""
            group = radio.category.name if radio.category else "Radio"
            stream_url = f"{base}/live/radio/{username}/{password}/{radio.id}.m3u8"
            extinf = (
                f'#EXTINF:-1 tvg-id="{radio.id}" tvg-name="{radio.title}" '
                f'tvg-logo="{logo}" group-title="{group}",{radio.title}'
            )
            lines.append(extinf)
            lines.append(stream_url)
        # Music playlists fallback
        playlists = db.query(MusicPlaylist).options(joinedload(MusicPlaylist.category)).all()
        for pl in playlists:
            logo = ""
            group = pl.category.name if pl.category else "Music"
            stream_url = f"{base}/radio/{username}/{password}/{pl.id}.m3u8"
            extinf = (
                f'#EXTINF:-1 tvg-id="{pl.id}" tvg-name="{pl.name}" '
                f'tvg-logo="{logo}" group-title="{group}",{pl.name}'
            )
            lines.append(extinf)
            lines.append(stream_url)

    return "\n".join(lines) + "\n"


@router.get("/live/{username}/{password}/{item_id}", tags=["stream"])
@router.get("/live/{username}/{password}/{item_id}.ts", tags=["stream"])
@router.get("/live/{username}/{password}/{item_id}.m3u8", tags=["stream"])
async def serve_live(username: str, password: str, item_id: int, request: Request, db: Session = Depends(get_db)):
    user = _auth_iptv_user(db, username, password)

    if _check_item_access(db, user, "vod_channel", item_id):
        playlist = db.query(Playlist).filter(Playlist.id == item_id).first()
        if playlist is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
        _do_checks_and_record(db, user, request, item_id, "vod_channel", getattr(playlist, "name", None))

        # ── LB playlist: main server'da HLS yok, dogrudan LB'den proxy al ──────
        _is_lb_playlist = (
            playlist.server is not None
            and playlist.server.server_type == ServerType.loadbalancer
        )
        if _is_lb_playlist:
            if not playlist.stream_url:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LB playlist stream URL eksik")
            try:
                resp = await _http_client.get(playlist.stream_url)
                resp.raise_for_status()
            except Exception:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LB stream alinamadi")
            proxy_base = f"http://{_server_host(db)}:{_server_port()}/hls-proxy/{playlist.id}/"
            lines = []
            for line in resp.text.splitlines():
                stripped = line.strip()
                if stripped and not stripped.startswith("#") and not stripped.startswith("http"):
                    lines.append(proxy_base + stripped)
                elif stripped.startswith("http") and stripped.endswith(".ts"):
                    lines.append(proxy_base + stripped.rsplit("/", 1)[-1])
                else:
                    lines.append(line)
            return PlainTextResponse(
                content="\n".join(lines) + "\n",
                media_type="application/vnd.apple.mpegurl",
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
            )

        # ── Main server playlist: once yerel HLS dosyasina bak ───────────────
        hls_path = f"{HLS_BASE_DIR}/{playlist.id}/stream.m3u8"
        if os.path.isfile(hls_path):
            with open(hls_path, "r") as f:
                m3u8_content = f.read()
            hls_base = f"http://{_server_host(db)}:{_server_port()}/hls/{playlist.id}/"
            rewritten_lines = []
            for line in m3u8_content.splitlines():
                if line.strip() and not line.startswith("#"):
                    rewritten_lines.append(hls_base + line.strip())
                else:
                    rewritten_lines.append(line)
            return Response(
                content="\n".join(rewritten_lines) + "\n",
                media_type="application/vnd.apple.mpegurl",
                headers={"Cache-Control": "no-cache"},
            )

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VOD Channel stream bulunamadi")

    if not _check_item_access(db, user, "tv", item_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erisim yok")
    tv = db.query(TvContent).filter(TvContent.id == item_id).first()
    if tv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanal bulunamadi")
    _do_checks_and_record(db, user, request, item_id, "tv", getattr(tv, "name", None))
    if tv.stream_url:
        return RedirectResponse(url=tv.stream_url, status_code=302)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream bulunamadi")


@router.get("/movie/{username}/{password}/{item_id}.mp4", tags=["stream"])
def serve_movie(username: str, password: str, item_id: int, request: Request, db: Session = Depends(get_db)):
    user = _auth_iptv_user(db, username, password)
    if not _check_item_access(db, user, "movie", item_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erisim yok")
    movie = db.query(MovieContent).filter(MovieContent.id == item_id).first()
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film bulunamadi")
    _do_checks_and_record(db, user, request, item_id, "movie", getattr(movie, "title", None))
    if movie.file_path and os.path.isfile(movie.file_path):
        return FileResponse(movie.file_path, media_type="video/mp4", filename=f"{movie.title}.mp4")
    if movie.source_url:
        return RedirectResponse(url=movie.source_url, status_code=302)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film dosyasi bulunamadi")


@router.get("/series/{username}/{password}/{item_id}.mp4", tags=["stream"])
def serve_series(username: str, password: str, item_id: int, request: Request, db: Session = Depends(get_db)):
    user = _auth_iptv_user(db, username, password)

    # --- Fix 1a: Check if item_id is a SeriesEpisode.id (per-episode URL) ---
    episode = db.query(SeriesEpisode).filter(SeriesEpisode.id == item_id).first()
    if episode is not None:
        # Resolve parent series to check access
        season = db.query(SeriesSeason).filter(SeriesSeason.id == episode.season_id).first()
        series_id = season.series_id if season else None
        if series_id is None or not _check_item_access(db, user, "series", series_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erisim yok")
        series = db.query(SeriesContent).filter(SeriesContent.id == series_id).first()
        series_name = getattr(series, "title", None) if series else None
        _do_checks_and_record(db, user, request, item_id, "series", series_name)
        has_file = episode.file_path and episode.file_path.strip() != "" and os.path.isfile(episode.file_path)
        if has_file:
            return FileResponse(episode.file_path, media_type="video/mp4")
        if episode.source_url and episode.source_url.strip() != "":
            return RedirectResponse(url=episode.source_url, status_code=302)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode dosyasi bulunamadi")

    # --- Fix 1b: Fallback — item_id is a SeriesContent.id, find first available episode ---
    if not _check_item_access(db, user, "series", item_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erisim yok")
    series = db.query(SeriesContent).filter(SeriesContent.id == item_id).first()
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")
    _do_checks_and_record(db, user, request, item_id, "series", getattr(series, "title", None))

    # Find first season/episode that actually has a file or source URL
    seasons = (
        db.query(SeriesSeason)
        .filter(SeriesSeason.series_id == item_id)
        .order_by(SeriesSeason.season_number.asc())
        .all()
    )
    for season in seasons:
        episodes = (
            db.query(SeriesEpisode)
            .filter(
                SeriesEpisode.season_id == season.id,
                or_(
                    SeriesEpisode.source_url.isnot(None),
                    SeriesEpisode.file_path.isnot(None),
                ),
            )
            .order_by(SeriesEpisode.episode_number.asc())
            .all()
        )
        for ep in episodes:
            has_file = ep.file_path and ep.file_path.strip() != "" and os.path.isfile(ep.file_path)
            if has_file:
                return FileResponse(ep.file_path, media_type="video/mp4")
            if ep.source_url and ep.source_url.strip() != "":
                return RedirectResponse(url=ep.source_url, status_code=302)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi dosyasi bulunamadi")


@router.get("/live/tv/{username}/{password}/{channel_id}", tags=["stream"])
@router.get("/live/tv/{username}/{password}/{channel_id}.ts", tags=["stream"])
async def serve_tv_channel(
    username: str, password: str, channel_id: int, request: Request, db: Session = Depends(get_db)
):
    """
    Xtream Codes style TV channel proxy via /live/tv/ prefix.
    Authenticates the IPTV user, fetches source HLS stream, rewrites segment URLs.
    """
    user = _auth_iptv_user(db, username, password)
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id, TvChannel.is_active == True).first()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TV kanal bulunamadi")
    _do_checks_and_record(db, user, request, channel_id, "tv", channel.name)

    ip_address = request.client.host if request.client else "unknown"
    viewer_tracker.track(username, channel_id, ip_address)

    # HLS proxy: rewrite m3u8 segments
    rewritten = await tv_stream.get_tv_m3u8_proxied(db, channel_id, username, password)
    return PlainTextResponse(content=rewritten, media_type="application/vnd.apple.mpegurl")


@router.get("/hls-proxy/tv/{channel_id}/{segment}", tags=["stream"])
async def hls_proxy_tv_segment(channel_id: int, segment: str, request: Request, db: Session = Depends(get_db)):
    """Segment relay for TV channels — no auth required (m3u8 was auth-protected)."""
    query_string = str(request.query_params) if request.query_params else ""
    content, media_type = await tv_stream.relay_tv_segment(db, channel_id, segment, query_string)
    return Response(content=content, media_type=media_type, headers={"Cache-Control": "no-cache"})


@router.get("/hls-proxy/radio/{channel_id}/{segment}", tags=["stream"])
async def hls_proxy_radio_segment(channel_id: int, segment: str, db: Session = Depends(get_db)):
    """Radio segment proxy — LB sunucudan segment cekip client'a relay eder.

    Auth gerektirmez (m3u8 zaten /live/radio/ uzerinden auth'lu alinmis).
    """
    channel = (
        db.query(RadioContent)
        .options(joinedload(RadioContent.server))
        .filter(RadioContent.id == channel_id)
        .first()
    )
    if channel is None or channel.server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radyo kanali veya LB sunucu bulunamadi")

    lb_ip = channel.server.ip_address
    lb_url = f"http://{lb_ip}/hls/radio_{channel_id}/{segment}"

    media_type = "application/vnd.apple.mpegurl" if segment.endswith(".m3u8") else "video/MP2T"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(lb_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Radio segment alinamadi")
            content = resp.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LB baglantisi basarisiz: {e}")

    return Response(content=content, media_type=media_type, headers={"Cache-Control": "no-cache"})


@router.get("/hls-proxy/{playlist_id}/{segment}", tags=["stream"])
async def hls_proxy_segment(playlist_id: int, segment: str, db: Session = Depends(get_db)):
    """
    Segment proxy — auth gerektirmez (m3u8 zaten /live/ uzerinden auth'lu alinmis).
    LB sunucudan segment'i cekip client'a streaming olarak relay eder.
    """
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if playlist is None or not playlist.stream_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")

    # LB IP'sini stream_url'den cikart (ornegin: http://138.201.196.89/hls/4/stream.m3u8)
    from urllib.parse import urlparse
    parsed = urlparse(playlist.stream_url)
    lb_base = f"{parsed.scheme}://{parsed.netloc}"
    lb_url = f"{lb_base}/hls/{playlist_id}/{segment}"

    # Content-Type belirle
    if segment.endswith(".m3u8"):
        media_type = "application/vnd.apple.mpegurl"
    else:
        media_type = "video/MP2T"

    try:
        # Tum segmenti bellegde tut (100KB-3MB arasi, guvenli)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(lb_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Segment alinamadi")
            content = resp.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LB baglantisi basarisiz: {e}")

    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/radio/{username}/{password}/{playlist_id}.m3u8", tags=["stream"])
async def serve_radio_music_playlist(
    username: str,
    password: str,
    playlist_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Serve a MusicPlaylist HLS stream (radio endpoint).

    Authenticates the IPTV user, locates the MusicPlaylist's HLS m3u8 on disk
    (or uses the stored stream_url), rewrites segment URLs to absolute paths
    served via nginx /hls/.
    """
    _auth_iptv_user(db, username, password)

    pl = db.query(MusicPlaylist).filter(MusicPlaylist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik playlist bulunamadi")

    hls_path = f"{HLS_BASE_DIR}/music_{playlist_id}/stream.m3u8"
    if os.path.isfile(hls_path):
        with open(hls_path, "r") as f:
            m3u8_content = f.read()
        hls_base = f"http://{_server_host(db)}:{_server_port()}/hls/music_{playlist_id}/"
        rewritten_lines = []
        for line in m3u8_content.splitlines():
            if line.strip() and not line.startswith("#"):
                rewritten_lines.append(hls_base + line.strip())
            else:
                rewritten_lines.append(line)
        return Response(
            content="\n".join(rewritten_lines) + "\n",
            media_type="application/vnd.apple.mpegurl",
            headers={"Cache-Control": "no-cache"},
        )

    if pl.stream_url:
        return RedirectResponse(url=pl.stream_url, status_code=302)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Muzik playlist stream bulunamadi — once playlist'i baslatin",
    )


@router.get("/live/radio/{username}/{password}/{channel_id}", tags=["stream"])
async def serve_radio_channel(
    username: str,
    password: str,
    channel_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Serve a RadioContent HLS stream.

    Authenticates the IPTV user, locates the RadioContent's HLS m3u8.
    - LB kanali: LB'den proxy al, segment URL'lerini main server uzerinden yonlendir.
    - Main server kanali: yerel HLS dosyasini oku (sadece canli, ENDLIST yoksa).
    - Fallback: external stream_url'e redirect.
    """
    # Strip .m3u8 extension if present
    clean_id = channel_id.replace(".m3u8", "")
    try:
        radio_id = int(clean_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid channel ID")

    user = _auth_iptv_user(db, username, password)

    channel = (
        db.query(RadioContent)
        .options(joinedload(RadioContent.server))
        .filter(RadioContent.id == radio_id)
        .first()
    )
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radyo kanali bulunamadi")

    # Record connection for online user tracking (Conns)
    _do_checks_and_record(db, user, request, radio_id, "radio", getattr(channel, "title", None))

    ip_address = request.client.host if request.client else "unknown"
    viewer_tracker.track(username, radio_id, ip_address)

    # ── LB radio: main server'da HLS yok, dogrudan LB'den proxy al ─────────
    if channel.server is not None and channel.server.server_type == ServerType.loadbalancer:
        lb_ip = channel.server.ip_address
        lb_hls_url = f"http://{lb_ip}/hls/radio_{radio_id}/stream.m3u8"
        try:
            resp = await _http_client.get(lb_hls_url)
            resp.raise_for_status()
        except Exception:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LB radyo stream alinamadi")
        proxy_base = f"http://{_server_host(db)}:{_server_port()}/hls-proxy/radio/{radio_id}/"
        lines = []
        for line in resp.text.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("http"):
                lines.append(proxy_base + stripped)
            elif stripped.startswith("http") and stripped.endswith(".ts"):
                lines.append(proxy_base + stripped.rsplit("/", 1)[-1])
            else:
                lines.append(line)
        return PlainTextResponse(
            content="\n".join(lines) + "\n",
            media_type="application/vnd.apple.mpegurl",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )

    # ── Main server radio: yerel HLS dosyasina bak (canli stream olmali) ────
    hls_path = f"{HLS_BASE_DIR}/radio_{radio_id}/stream.m3u8"
    if os.path.isfile(hls_path):
        with open(hls_path, "r") as f:
            m3u8_content = f.read()
        # Stale/ended stream kontrolu: #EXT-X-ENDLIST varsa eski cache — kullanma
        if "#EXT-X-ENDLIST" not in m3u8_content:
            hls_base = f"http://{_server_host(db)}:{_server_port()}/hls/radio_{radio_id}/"
            rewritten_lines = []
            for line in m3u8_content.splitlines():
                if line.strip() and not line.startswith("#"):
                    rewritten_lines.append(hls_base + line.strip())
                else:
                    rewritten_lines.append(line)
            return Response(
                content="\n".join(rewritten_lines) + "\n",
                media_type="application/vnd.apple.mpegurl",
                headers={"Cache-Control": "no-cache"},
            )

    # Fallback: redirect to the external stream_url directly
    if channel.stream_url:
        return RedirectResponse(url=channel.stream_url, status_code=302)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Radyo kanali stream bulunamadi — once kanali baslatin",
    )