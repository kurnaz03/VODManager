import json
import random
import string
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.modules.content.models import Bouquet
from app.modules.iptv_users.models import IptvUser, UserBouquet
from app.modules.iptv_users.schemas import IptvUserCreate, IptvUserUpdate


def _random_str(length: int, prefix: str = "") -> str:
    chars = string.ascii_lowercase + string.digits
    return prefix + "".join(random.choices(chars, k=length))


def _parse_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        result = json.loads(value)
        if isinstance(result, list):
            return [str(x) for x in result]
    except Exception:
        pass
    return []


def _serialize_user(
    user: IptvUser,
    active_connections: int = 0,
    last_ip: str | None = None,
    last_isp: str | None = None,
    last_country_code: str | None = None,
) -> dict[str, Any]:
    bouquets_data = []
    for ub in (user.bouquets or []):
        b = ub.bouquet
        if b:
            bouquets_data.append({
                "id": b.id,
                "name": b.name,
                "item_count": len(b.items) if hasattr(b, "items") else 0,
            })
    return {
        "id": user.id,
        "username": user.username,
        "password": user.password,
        "owner": user.owner,
        "max_connections": user.max_connections,
        "is_trial": user.is_trial,
        "is_enabled": user.is_enabled,
        "created_at": user.created_at,
        "expiry_date": user.expiry_date,
        "admin_notes": user.admin_notes,
        "reseller_notes": user.reseller_notes,
        "forced_connection": user.forced_connection,
        "is_restreamer": user.is_restreamer,
        "forced_country": user.forced_country,
        "isp_lock_info": user.isp_lock_info,
        "access_hls": user.access_hls,
        "access_mpegts": user.access_mpegts,
        "access_rtmp": user.access_rtmp,
        "allowed_ips": _parse_json_list(user.allowed_ips),
        "allowed_user_agents": _parse_json_list(user.allowed_user_agents),
        "active_connections": active_connections,
        "last_ip": last_ip,
        "last_isp": last_isp,
        "last_country_code": last_country_code,
        "bouquets": bouquets_data,
    }


def _load_user(db: Session, user_id: int) -> IptvUser:
    user = (
        db.query(IptvUser)
        .options(
            joinedload(IptvUser.bouquets).joinedload(UserBouquet.bouquet).joinedload(Bouquet.items)
        )
        .filter(IptvUser.id == user_id)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")
    return user


def list_users(db: Session, search: str | None = None) -> list[dict[str, Any]]:
    from datetime import datetime, timezone, timedelta
    from app.modules.connections.models import UserConnection
    from sqlalchemy import func as sqlfunc
    query = (
        db.query(IptvUser)
        .options(
            joinedload(IptvUser.bouquets).joinedload(UserBouquet.bouquet).joinedload(Bouquet.items)
        )
        .order_by(IptvUser.id.desc())
    )
    if search:
        query = query.filter(IptvUser.username.ilike(f"%{search}%"))
    users = query.all()
    # Aktif bağlantı sayılarını ve ISP/ülke bilgisini tek sorguda al
    expire_threshold = datetime.now(timezone.utc) - timedelta(seconds=60)
    rows = (
        db.query(UserConnection.user_id, sqlfunc.count(UserConnection.id).label("cnt"))
        .filter(UserConnection.is_active == True, UserConnection.last_seen_at >= expire_threshold)
        .group_by(UserConnection.user_id)
        .all()
    )
    conn_map = {r.user_id: r.cnt for r in rows}

    # En son bağlantının ISP/ülke bilgisini al (aktif veya son bağlantı)
    # Önce aktif bağlantılardan al, yoksa son bilinen bağlantıdan al
    all_user_ids = [u.id for u in users]
    isp_map: dict[int, tuple[str | None, str | None, str | None]] = {}
    if all_user_ids:
        # Sadece aktif baglantılardan ISP/ulke bilgisini al (is_active=True + 120s tolerans)
        isp_threshold = datetime.now(timezone.utc) - timedelta(seconds=120)
        all_conns = (
            db.query(UserConnection)
            .filter(
                UserConnection.user_id.in_(all_user_ids),
                UserConnection.is_active == True,
                UserConnection.last_seen_at >= isp_threshold,
            )
            .order_by(UserConnection.user_id, UserConnection.last_seen_at.desc())
            .all()
        )
        seen: set[int] = set()
        for c in all_conns:
            if c.user_id not in seen:
                isp_map[c.user_id] = (c.ip_address, c.isp_name, c.country_code)
                seen.add(c.user_id)

    return [
        _serialize_user(
            u,
            conn_map.get(u.id, 0),
            *isp_map.get(u.id, (None, None, None)),
        )
        for u in users
    ]


def create_user(db: Session, payload: IptvUserCreate) -> dict[str, Any]:
    username = (payload.username or "").strip() or _random_str(8, "user_")
    password = (payload.password or "").strip() or _random_str(12)

    if db.query(IptvUser).filter(IptvUser.username == username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kullanici adi zaten mevcut")

    user = IptvUser(
        username=username,
        password=password,
        owner=payload.owner,
        max_connections=payload.max_connections,
        is_trial=payload.is_trial,
        is_enabled=payload.is_enabled,
        expiry_date=payload.expiry_date,
        admin_notes=payload.admin_notes,
        reseller_notes=payload.reseller_notes,
        forced_connection=payload.forced_connection,
        is_restreamer=payload.is_restreamer,
        forced_country=payload.forced_country,
        isp_lock_info=payload.isp_lock_info,
        access_hls=payload.access_hls,
        access_mpegts=payload.access_mpegts,
        access_rtmp=payload.access_rtmp,
        allowed_ips=json.dumps(payload.allowed_ips) if payload.allowed_ips else None,
        allowed_user_agents=json.dumps(payload.allowed_user_agents) if payload.allowed_user_agents else None,
    )
    db.add(user)
    db.flush()

    for bouquet_id in payload.bouquet_ids:
        bouquet = db.query(Bouquet).filter(Bouquet.id == bouquet_id).first()
        if bouquet:
            db.add(UserBouquet(user_id=user.id, bouquet_id=bouquet_id))

    db.commit()
    return _serialize_user(_load_user(db, user.id))


def get_user(db: Session, user_id: int) -> dict[str, Any]:
    from datetime import datetime, timezone, timedelta
    from app.modules.connections.models import UserConnection
    from sqlalchemy import func as sqlfunc
    user = _load_user(db, user_id)
    expire_threshold = datetime.now(timezone.utc) - timedelta(seconds=60)
    active_cnt = (
        db.query(sqlfunc.count(UserConnection.id))
        .filter(UserConnection.user_id == user_id, UserConnection.is_active == True, UserConnection.last_seen_at >= expire_threshold)
        .scalar() or 0
    )
    return _serialize_user(user, active_cnt)


def update_user(db: Session, user_id: int, payload: IptvUserUpdate) -> dict[str, Any]:
    user = _load_user(db, user_id)

    if payload.username is not None:
        new_username = payload.username.strip()
        if new_username and new_username != user.username:
            if db.query(IptvUser).filter(IptvUser.username == new_username, IptvUser.id != user_id).first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kullanici adi zaten mevcut")
            user.username = new_username

    if payload.password is not None:
        p = payload.password.strip()
        if p:
            user.password = p

    if payload.owner is not None:
        user.owner = payload.owner
    if payload.max_connections is not None:
        user.max_connections = payload.max_connections
    if payload.is_trial is not None:
        user.is_trial = payload.is_trial
    if payload.is_enabled is not None:
        user.is_enabled = payload.is_enabled
    if payload.expiry_date is not None:
        user.expiry_date = payload.expiry_date
    else:
        # explicit null clears the field only when included in request
        if "expiry_date" in payload.model_fields_set:
            user.expiry_date = None
    if payload.admin_notes is not None:
        user.admin_notes = payload.admin_notes
    if payload.reseller_notes is not None:
        user.reseller_notes = payload.reseller_notes
    if payload.forced_connection is not None:
        user.forced_connection = payload.forced_connection
    if payload.is_restreamer is not None:
        user.is_restreamer = payload.is_restreamer
    if payload.forced_country is not None:
        user.forced_country = payload.forced_country
    if payload.isp_lock_info is not None:
        user.isp_lock_info = payload.isp_lock_info
    if payload.access_hls is not None:
        user.access_hls = payload.access_hls
    if payload.access_mpegts is not None:
        user.access_mpegts = payload.access_mpegts
    if payload.access_rtmp is not None:
        user.access_rtmp = payload.access_rtmp
    if payload.allowed_ips is not None:
        user.allowed_ips = json.dumps(payload.allowed_ips)
    if payload.allowed_user_agents is not None:
        user.allowed_user_agents = json.dumps(payload.allowed_user_agents)

    db.flush()

    if payload.bouquet_ids is not None:
        db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete(synchronize_session='fetch')
        db.flush()
        for bouquet_id in payload.bouquet_ids:
            bouquet = db.query(Bouquet).filter(Bouquet.id == bouquet_id).first()
            if bouquet:
                db.add(UserBouquet(user_id=user_id, bouquet_id=bouquet_id))

    db.commit()
    return _serialize_user(_load_user(db, user_id))


def delete_user(db: Session, user_id: int) -> None:
    from app.modules.connections.models import UserConnection, UserWatchHistory

    user = db.query(IptvUser).filter(IptvUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    # İlgili kayıtları önce sil (DB-level CASCADE olmasa da çalışır)
    db.query(UserConnection).filter(UserConnection.user_id == user_id).delete(synchronize_session="fetch")
    db.query(UserWatchHistory).filter(UserWatchHistory.user_id == user_id).delete(synchronize_session="fetch")
    db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete(synchronize_session="fetch")
    db.flush()

    db.delete(user)
    db.commit()


def assign_bouquet(db: Session, user_id: int, bouquet_id: int) -> dict[str, Any]:
    _load_user(db, user_id)
    bouquet = db.query(Bouquet).filter(Bouquet.id == bouquet_id).first()
    if bouquet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bouquet bulunamadi")
    existing = db.query(UserBouquet).filter(
        UserBouquet.user_id == user_id, UserBouquet.bouquet_id == bouquet_id
    ).first()
    if existing is None:
        db.add(UserBouquet(user_id=user_id, bouquet_id=bouquet_id))
        db.commit()
    return _serialize_user(_load_user(db, user_id))


def unassign_bouquet(db: Session, user_id: int, bouquet_id: int) -> None:
    ub = db.query(UserBouquet).filter(
        UserBouquet.user_id == user_id, UserBouquet.bouquet_id == bouquet_id
    ).first()
    if ub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bouquet atamasÃ„Â± bulunamadi")
    db.delete(ub)
    db.commit()


def generate_m3u(db: Session, user_id: int, server_host: str, fmt: str = "m3u_plus") -> str:
    """Generate M3U playlist for the user's bouquets."""
    user = _load_user(db, user_id)
    lines = ["#EXTM3U"]

    for ub in (user.bouquets or []):
        bouquet = ub.bouquet
        if not bouquet:
            continue
        bouquet_name = bouquet.name
        items = sorted(bouquet.items, key=lambda x: (x.position, x.id))
        for item in items:
            item_type = item.item_type.value if hasattr(item.item_type, "value") else item.item_type
            from app.modules.content.service import _get_item_metadata
            title, logo = _get_item_metadata(db, item_type, item.item_id)
            title = title or f"Item {item.item_id}"
            logo = logo or ""
            stream_url = f"http://{server_host}/{user.username}/{user.password}/{item.item_id}.ts"
            if fmt == "m3u8":
                stream_url = f"http://{server_host}/{user.username}/{user.password}/{item.item_id}/index.m3u8"
            extinf = (
                f"#EXTINF:-1 tvg-id=\"{item.item_id}\" tvg-name=\"{title}\" "
                f"tvg-logo=\"{logo}\" group-title=\"{bouquet_name}\",{title}"
            )
            lines.append(extinf)
            lines.append(stream_url)

    return "\n".join(lines) + "\n"
