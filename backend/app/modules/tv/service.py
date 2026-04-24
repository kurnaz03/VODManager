from typing import List, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.tv.models import TvChannel, TvChannelBouquet, TvChannelServer
from app.modules.tv.schemas import TvChannelCreate, TvChannelOut, TvChannelUpdate


def _enrich_channel(channel: TvChannel) -> dict:
    """Convert ORM object to dict enriched with relational names."""
    servers_out = []
    for s in (channel.servers or []):
        srv = s.server
        servers_out.append({
            "id": s.id,
            "tv_channel_id": s.tv_channel_id,
            "server_id": s.server_id,
            "server_name": srv.name if srv else None,
            "server_ip": srv.ip_address if srv else None,
            "is_active": s.is_active,
            "priority": s.priority,
            "created_at": s.created_at,
        })

    bouquets_out = []
    for b in (channel.bouquet_assignments or []):
        bq = b.bouquet
        bouquets_out.append({
            "id": b.id,
            "tv_channel_id": b.tv_channel_id,
            "bouquet_id": b.bouquet_id,
            "bouquet_name": bq.name if bq else None,
            "position": b.position,
            "created_at": b.created_at,
        })

    cat_name = channel.category.name if channel.category else None

    return {
        "id": channel.id,
        "name": channel.name,
        "logo_url": channel.logo_url,
        "epg_channel_id": channel.epg_channel_id,
        "stream_url": channel.stream_url,
        "category_id": channel.category_id,
        "category_name": cat_name,
        "is_active": channel.is_active,
        "sort_order": channel.sort_order,
        "created_at": channel.created_at,
        "updated_at": channel.updated_at,
        "servers": servers_out,
        "bouquet_assignments": bouquets_out,
    }


def list_channels(db: Session, category_id: Optional[int] = None, active_only: bool = False) -> List[dict]:
    q = (
        db.query(TvChannel)
        .options(
            joinedload(TvChannel.category),
            joinedload(TvChannel.servers).joinedload(TvChannelServer.server),
            joinedload(TvChannel.bouquet_assignments).joinedload(TvChannelBouquet.bouquet),
        )
        .order_by(TvChannel.sort_order.asc(), TvChannel.id.asc())
    )
    if category_id is not None:
        q = q.filter(TvChannel.category_id == category_id)
    if active_only:
        q = q.filter(TvChannel.is_active == True)
    return [_enrich_channel(ch) for ch in q.all()]


def get_channel(db: Session, channel_id: int) -> dict:
    channel = (
        db.query(TvChannel)
        .options(
            joinedload(TvChannel.category),
            joinedload(TvChannel.servers).joinedload(TvChannelServer.server),
            joinedload(TvChannel.bouquet_assignments).joinedload(TvChannelBouquet.bouquet),
        )
        .filter(TvChannel.id == channel_id)
        .first()
    )
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanal bulunamadi")
    return _enrich_channel(channel)


def _sync_servers(db: Session, channel: TvChannel, server_ids: List[int]) -> None:
    existing = {s.server_id: s for s in (channel.servers or [])}
    new_set = set(server_ids)
    # Remove servers not in new list
    for sid, srv in list(existing.items()):
        if sid not in new_set:
            db.delete(srv)
    # Add new servers
    for idx, sid in enumerate(server_ids):
        if sid not in existing:
            db.add(TvChannelServer(tv_channel_id=channel.id, server_id=sid, priority=idx))


def _sync_bouquets(db: Session, channel: TvChannel, bouquet_ids: List[int]) -> None:
    existing = {b.bouquet_id: b for b in (channel.bouquet_assignments or [])}
    new_set = set(bouquet_ids)
    for bid, bq in list(existing.items()):
        if bid not in new_set:
            db.delete(bq)
    for idx, bid in enumerate(bouquet_ids):
        if bid not in existing:
            db.add(TvChannelBouquet(tv_channel_id=channel.id, bouquet_id=bid, position=idx))


def create_channel(db: Session, payload: TvChannelCreate) -> dict:
    channel = TvChannel(
        name=payload.name,
        logo_url=payload.logo_url,
        epg_channel_id=payload.epg_channel_id,
        stream_url=payload.stream_url,
        category_id=payload.category_id,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(channel)
    db.flush()  # get channel.id

    for idx, sid in enumerate(payload.server_ids):
        db.add(TvChannelServer(tv_channel_id=channel.id, server_id=sid, priority=idx))
    for idx, bid in enumerate(payload.bouquet_ids):
        db.add(TvChannelBouquet(tv_channel_id=channel.id, bouquet_id=bid, position=idx))

    db.commit()
    db.refresh(channel)
    return get_channel(db, channel.id)


def update_channel(db: Session, channel_id: int, payload: TvChannelUpdate) -> dict:
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id).first()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanal bulunamadi")

    if payload.name is not None:
        channel.name = payload.name
    if payload.logo_url is not None:
        channel.logo_url = payload.logo_url
    if payload.epg_channel_id is not None:
        channel.epg_channel_id = payload.epg_channel_id
    if payload.stream_url is not None:
        channel.stream_url = payload.stream_url
    if payload.category_id is not None:
        channel.category_id = payload.category_id
    if payload.is_active is not None:
        channel.is_active = payload.is_active
    if payload.sort_order is not None:
        channel.sort_order = payload.sort_order

    if payload.server_ids is not None:
        # Force load existing servers before sync
        db.query(TvChannelServer).filter(TvChannelServer.tv_channel_id == channel_id).delete()
        db.flush()
        for idx, sid in enumerate(payload.server_ids):
            db.add(TvChannelServer(tv_channel_id=channel.id, server_id=sid, priority=idx))

    if payload.bouquet_ids is not None:
        db.query(TvChannelBouquet).filter(TvChannelBouquet.tv_channel_id == channel_id).delete()
        db.flush()
        for idx, bid in enumerate(payload.bouquet_ids):
            db.add(TvChannelBouquet(tv_channel_id=channel.id, bouquet_id=bid, position=idx))

    db.commit()
    return get_channel(db, channel_id)


def delete_channel(db: Session, channel_id: int) -> None:
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id).first()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanal bulunamadi")
    db.delete(channel)
    db.commit()


async def test_channel_stream(db: Session, channel_id: int) -> dict:
    channel = db.query(TvChannel).filter(TvChannel.id == channel_id).first()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanal bulunamadi")
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(channel.stream_url)
            ok = resp.status_code < 400
            return {
                "channel_id": channel_id,
                "stream_url": channel.stream_url,
                "ok": ok,
                "status_code": resp.status_code,
                "message": "Stream erisilebilir" if ok else f"HTTP {resp.status_code}",
            }
    except Exception as e:
        return {
            "channel_id": channel_id,
            "stream_url": channel.stream_url,
            "ok": False,
            "status_code": None,
            "message": str(e),
        }
