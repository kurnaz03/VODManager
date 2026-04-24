"""
TV Stream Proxy Service
-----------------------
Proxies HLS streams for TvChannel records.
- /live/{username}/{password}/{channel_id}.ts  (handled in stream router)
- /hls-proxy/tv/{channel_id}/{segment}         (segment relay)
"""
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.tv.models import TvChannel, TvChannelServer

SERVER_HOST = "62.210.92.252"
SERVER_PORT = 8080

_http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)


def pick_server_for_channel(db: Session, channel_id: int):
    """Return the highest-priority active TvChannelServer for a channel, or None."""
    return (
        db.query(TvChannelServer)
        .filter(
            TvChannelServer.tv_channel_id == channel_id,
            TvChannelServer.is_active == True,
        )
        .order_by(TvChannelServer.priority.asc())
        .first()
    )


async def get_tv_m3u8_proxied(db: Session, channel_id: int, username: str, password: str) -> str:
    """
    Fetch the source m3u8 for a TvChannel and rewrite segment URLs to
    go through /hls-proxy/tv/{channel_id}/{segment}.
    Returns the rewritten m3u8 text.
    """
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id).first()
    if channel is None or not channel.stream_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TV kanal stream bulunamadi")

    try:
        resp = await _http_client.get(channel.stream_url)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Kaynak stream alinamadi: {e}")

    proxy_base = f"http://{SERVER_HOST}:{SERVER_PORT}/hls-proxy/tv/{channel_id}/"
    lines = []
    for line in resp.text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            if stripped.startswith("http"):
                if stripped.endswith(".ts") or ".ts?" in stripped:
                    seg_name = stripped.rsplit("/", 1)[-1]
                    lines.append(proxy_base + seg_name)
                elif stripped.endswith(".m3u8") or ".m3u8?" in stripped:
                    # sub-playlist: keep absolute but pass through proxy base
                    seg_name = stripped.rsplit("/", 1)[-1]
                    lines.append(proxy_base + seg_name)
                else:
                    lines.append(stripped)
            else:
                # Relative path
                lines.append(proxy_base + stripped)
        else:
            lines.append(line)

    return "\n".join(lines) + "\n"


async def relay_tv_segment(db: Session, channel_id: int, segment: str, query_string: str = "") -> tuple[bytes, str]:
    """
    Fetch a single HLS segment from the source stream URL base and return (content, media_type).
    query_string is passed from the request to preserve session params like nimblesessionid.
    """
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id).first()
    if channel is None or not channel.stream_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TV kanal bulunamadi")

    parsed = urlparse(channel.stream_url)
    # Build base URL (directory of the m3u8)
    path_parts = parsed.path.rsplit("/", 1)
    base_path = path_parts[0] + "/" if len(path_parts) > 1 else "/"
    lb_url = f"{parsed.scheme}://{parsed.netloc}{base_path}{segment}"
    if query_string:
        lb_url += f"?{query_string}"

    media_type = "application/vnd.apple.mpegurl" if segment.endswith(".m3u8") else "video/MP2T"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(lb_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Segment alinamadi: {resp.status_code}")
            return resp.content, media_type
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Segment baglantisi basarisiz: {e}")
