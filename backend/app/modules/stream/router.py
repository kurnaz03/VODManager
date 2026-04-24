import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse, StreamingResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.modules.content.models import (
    Bouquet, BouquetItem, BouquetItemType, MovieContent, SeriesContent,
    SeriesEpisode, SeriesSeason, TvContent,
)
from app.modules.iptv_users.models import IptvUser, UserBouquet
from app.modules.playlist.models import Playlist
from app.modules.connections import service as conn_svc
from app.modules.tv.models import TvChannel
from app.modules.tv import stream_service as tv_stream

router = APIRouter()

# Module-level async HTTP client for connection pooling
_http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)

SERVER_HOST = "62.210.92.252"
SERVER_PORT = 8080
HLS_BASE_DIR = "/var/www/vod-manager/shared/hls"


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
        return False
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


@router.get("/get.php", response_class=PlainTextResponse, tags=["stream"])
def get_m3u_plus(
    username: str = Query(...),
    password: str = Query(...),
    type: str = Query("m3u_plus"),
    output: str = Query("mpegts"),
    db: Session = Depends(get_db),
):
    user = _auth_iptv_user(db, username, password)
    base = f"http://{SERVER_HOST}:{SERVER_PORT}"
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
            elif item_type == "movie":
                stream_url = f"{base}/movie/{username}/{password}/{item.item_id}.mp4"
            elif item_type == "series":
                stream_url = f"{base}/series/{username}/{password}/{item.item_id}.mp4"
            elif item_type == "vod_channel":
                stream_url = f"{base}/live/{username}/{password}/{item.item_id}"
            else:
                stream_url = f"{base}/live/{username}/{password}/{item.item_id}.ts"

            extinf = (
                f'#EXTINF:-1 tvg-id="{item.item_id}" tvg-name="{title}" '
                f'tvg-logo="{logo}" group-title="{bouquet.name}",{title}'
            )
            lines.append(extinf)
            lines.append(stream_url)

    # TV Channels (from tv_channel_bouquets)
    from app.modules.tv.models import TvChannel, TvChannelBouquet
    bouquet_ids = [ub.bouquet_id for ub in (user.bouquets or [])]
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

    return "\n".join(lines) + "\n"


@router.get("/live/{username}/{password}/{item_id}", tags=["stream"])
@router.get("/live/{username}/{password}/{item_id}.ts", tags=["stream"])
async def serve_live(username: str, password: str, item_id: int, request: Request, db: Session = Depends(get_db)):
    user = _auth_iptv_user(db, username, password)

    if _check_item_access(db, user, "vod_channel", item_id):
        playlist = db.query(Playlist).filter(Playlist.id == item_id).first()
        if playlist is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist bulunamadi")
        _do_checks_and_record(db, user, request, item_id, "vod_channel", getattr(playlist, "name", None))

        if playlist.stream_url:
            # LB sunucudaki remote stream — m3u8'i proxy et, segment URL'lerini rewrite et
            try:
                resp = await _http_client.get(playlist.stream_url)
                resp.raise_for_status()
            except Exception:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LB stream alinamadi")

            # Relative segment path'lerini /hls-proxy/ uzerinden rewrite et
            proxy_base = f"http://{SERVER_HOST}:{SERVER_PORT}/hls-proxy/{playlist.id}/"
            lines = []
            for line in resp.text.splitlines():
                stripped = line.strip()
                if stripped and not stripped.startswith("#") and not stripped.startswith("http"):
                    # Relative path (ornegin: seg_00100.ts)
                    lines.append(proxy_base + stripped)
                elif stripped.startswith("http"):
                    # Zaten absolute URL ise de proxy'e yonlendir
                    # Sadece segment dosyalari (.ts)
                    if stripped.endswith(".ts"):
                        seg_name = stripped.rsplit("/", 1)[-1]
                        lines.append(proxy_base + seg_name)
                    else:
                        lines.append(stripped)
                else:
                    lines.append(line)

            rewritten = "\n".join(lines) + "\n"
            return PlainTextResponse(
                content=rewritten,
                media_type="application/vnd.apple.mpegurl",
            )

        # Yerel HLS (LB yok, ana sunucu) — segment URL'leri mutlak yap
        hls_path = f"{HLS_BASE_DIR}/{playlist.id}/stream.m3u8"
        if os.path.isfile(hls_path):
            with open(hls_path, "r") as f:
                m3u8_content = f.read()
            hls_base = f"http://{SERVER_HOST}:{SERVER_PORT}/hls/{playlist.id}/"
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
    if not _check_item_access(db, user, "series", item_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erisim yok")
    series = db.query(SeriesContent).filter(SeriesContent.id == item_id).first()
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")
    _do_checks_and_record(db, user, request, item_id, "series", getattr(series, "title", None))
    first_season = (
        db.query(SeriesSeason)
        .filter(SeriesSeason.series_id == item_id)
        .order_by(SeriesSeason.season_number.asc())
        .first()
    )
    if first_season:
        first_ep = (
            db.query(SeriesEpisode)
            .filter(SeriesEpisode.season_id == first_season.id)
            .order_by(SeriesEpisode.episode_number.asc())
            .first()
        )
        if first_ep:
            if first_ep.file_path and os.path.isfile(first_ep.file_path):
                return FileResponse(first_ep.file_path, media_type="video/mp4")
            if first_ep.source_url:
                return RedirectResponse(url=first_ep.source_url, status_code=302)
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

    # HLS proxy: rewrite m3u8 segments
    rewritten = await tv_stream.get_tv_m3u8_proxied(db, channel_id, username, password)
    return PlainTextResponse(content=rewritten, media_type="application/vnd.apple.mpegurl")


@router.get("/hls-proxy/tv/{channel_id}/{segment}", tags=["stream"])
async def hls_proxy_tv_segment(channel_id: int, segment: str, request: Request, db: Session = Depends(get_db)):
    """Segment relay for TV channels — no auth required (m3u8 was auth-protected)."""
    query_string = str(request.query_params) if request.query_params else ""
    content, media_type = await tv_stream.relay_tv_segment(db, channel_id, segment, query_string)
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