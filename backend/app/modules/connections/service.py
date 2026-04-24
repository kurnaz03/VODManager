"""
Bağlantı takibi ve geolocation servisi.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.connections.models import UserConnection, UserWatchHistory
from app.modules.iptv_users.models import IptvUser


# ---------------------------------------------------------------------------
# Geolocation
# ---------------------------------------------------------------------------

def get_geo_info(ip: str) -> dict[str, str]:
    """ip-api.com ücretsiz API ile IP bilgisi çek. Hata durumunda boş döner."""
    # Lokal/private IP'ler için sorgu yapma
    if ip in ("127.0.0.1", "::1") or ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172."):
        return {"country": "", "countryCode": "", "isp": ""}
    try:
        resp = httpx.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,isp", timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("countryCode"):
                return {
                    "country": data.get("country", ""),
                    "countryCode": data.get("countryCode", ""),
                    "isp": data.get("isp", ""),
                }
    except Exception:
        pass
    return {"country": "", "countryCode": "", "isp": ""}


# ---------------------------------------------------------------------------
# Bağlantı doğrulama (kilitleme kontrolleri)
# ---------------------------------------------------------------------------

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


def check_restrictions(db: Session, user: IptvUser, ip: str, geo: dict[str, str]) -> None:
    """
    ISP / IP / Ülke kısıtlamalarını kontrol et.
    Kural ihlali varsa HTTPException(403) fırlatır.
    """
    # ISP kilidi
    if user.isp_lock_info:
        isp_lock = user.isp_lock_info.strip()
        if isp_lock and geo.get("isp"):
            if isp_lock.lower() not in geo["isp"].lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="ISP kısıtlaması: Bu bağlantıya izin verilmiyor",
                )
        elif isp_lock and not geo.get("isp"):
            # ISP bilgisi çekilemedi, geçir
            pass

    # IP kilidi
    allowed_ips = _parse_json_list(user.allowed_ips)
    if allowed_ips and ip not in allowed_ips:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP kısıtlaması: Bu IP adresine izin verilmiyor",
        )

    # Ülke kısıtlaması
    if user.forced_country:
        allowed_cc = [c.strip().upper() for c in user.forced_country.split(",") if c.strip()]
        if allowed_cc:
            user_cc = (geo.get("countryCode") or "").upper()
            if user_cc and user_cc not in allowed_cc:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Ülke kısıtlaması: {user_cc} ülkesinden erişim yasak",
                )


def check_max_connections(db: Session, user: IptvUser) -> None:
    """Aktif bağlantı sayısını kontrol et. max_connections=0 → sınırsız."""
    if user.max_connections == 0:
        return
    # 60 saniyedir güncellenmemiş bağlantıları pasife al
    expire_threshold = datetime.now(timezone.utc) - timedelta(seconds=60)
    db.query(UserConnection).filter(
        UserConnection.user_id == user.id,
        UserConnection.is_active == True,
        UserConnection.last_seen_at < expire_threshold,
    ).update({"is_active": False})
    db.flush()

    active_count = db.query(func.count(UserConnection.id)).filter(
        UserConnection.user_id == user.id,
        UserConnection.is_active == True,
    ).scalar() or 0

    if active_count >= user.max_connections:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maksimum bağlantı sayısı aşıldı",
        )


# ---------------------------------------------------------------------------
# Bağlantı kayıt/güncelleme
# ---------------------------------------------------------------------------

def record_connection(
    db: Session,
    user: IptvUser,
    ip: str,
    geo: dict[str, str],
    stream_id: int | None,
    stream_type: str | None,
    user_agent: str | None,
    stream_name: str | None = None,
) -> tuple[UserConnection, UserWatchHistory]:
    """
    Bağlantıyı kaydet veya güncelle, izleme geçmişine ekle.
    Returns (connection, watch_entry)
    """
    now = datetime.now(timezone.utc)

    # Kanal değiştirmede eski bağlantıları kapat:
    # Aynı user_id + IP için farklı stream'e bağlı aktif kayıtları pasife al.
    db.query(UserConnection).filter(
        UserConnection.user_id == user.id,
        UserConnection.ip_address == ip,
        UserConnection.is_active == True,
        (UserConnection.stream_id != stream_id) | (UserConnection.stream_type != stream_type),
    ).update({"is_active": False}, synchronize_session=False)
    db.flush()

    # Aynı kullanıcı + IP + stream için mevcut aktif bağlantı var mı?
    conn = db.query(UserConnection).filter(
        UserConnection.user_id == user.id,
        UserConnection.ip_address == ip,
        UserConnection.stream_id == stream_id,
        UserConnection.stream_type == stream_type,
        UserConnection.is_active == True,
    ).first()

    if conn:
        conn.last_seen_at = now
        # Geo bilgisi eksikse yeniden sorgula
        if not conn.isp_name or not conn.country_code:
            fresh_geo = get_geo_info(ip)
            if fresh_geo.get("isp"):
                conn.isp_name = fresh_geo["isp"]
            if fresh_geo.get("countryCode"):
                conn.country_code = fresh_geo["countryCode"]
            if fresh_geo.get("country"):
                conn.country_name = fresh_geo["country"]
        db.add(conn)
        # İzleme geçmişini güncelle
        wh = db.query(UserWatchHistory).filter(
            UserWatchHistory.user_id == user.id,
            UserWatchHistory.stream_id == stream_id,
            UserWatchHistory.started_at == conn.started_at,
        ).first()
        if wh and not wh.ended_at:
            delta = (now - conn.started_at).total_seconds()
            wh.duration_seconds = int(delta)
            if not wh.isp_name and conn.isp_name:
                wh.isp_name = conn.isp_name
            if not wh.country_code and conn.country_code:
                wh.country_code = conn.country_code
            db.add(wh)
    else:
        conn = UserConnection(
            user_id=user.id,
            ip_address=ip,
            isp_name=geo.get("isp", ""),
            country_code=geo.get("countryCode", ""),
            country_name=geo.get("country", ""),
            user_agent=user_agent,
            stream_id=stream_id,
            stream_type=stream_type,
            started_at=now,
            last_seen_at=now,
            is_active=True,
        )
        db.add(conn)
        db.flush()

        wh = UserWatchHistory(
            user_id=user.id,
            stream_id=stream_id,
            stream_name=stream_name,
            stream_type=stream_type,
            ip_address=ip,
            country_code=geo.get("countryCode", ""),
            isp_name=geo.get("isp", ""),
            started_at=now,
        )
        db.add(wh)

    db.commit()
    db.refresh(conn)
    return conn, wh


# ---------------------------------------------------------------------------
# Aktif bağlantı listesi
# ---------------------------------------------------------------------------

def get_active_connections(db: Session, user_id: int) -> list[dict[str, Any]]:
    # 60 saniyedir güncellenmemiş bağlantıları pasife al
    expire_threshold = datetime.now(timezone.utc) - timedelta(seconds=60)
    db.query(UserConnection).filter(
        UserConnection.user_id == user_id,
        UserConnection.is_active == True,
        UserConnection.last_seen_at < expire_threshold,
    ).update({"is_active": False})
    db.commit()

    conns = db.query(UserConnection).filter(
        UserConnection.user_id == user_id,
        UserConnection.is_active == True,
    ).all()

    return [_conn_to_dict(c) for c in conns]


def _conn_to_dict(c: UserConnection) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    started = c.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    duration = int((now - started).total_seconds())
    return {
        "id": c.id,
        "user_id": c.user_id,
        "ip_address": c.ip_address,
        "isp_name": c.isp_name,
        "country_code": c.country_code,
        "country_name": c.country_name,
        "user_agent": c.user_agent,
        "stream_id": c.stream_id,
        "stream_type": c.stream_type,
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
        "duration_seconds": duration,
        "is_active": c.is_active,
    }


# ---------------------------------------------------------------------------
# Ban / Kill işlemleri
# ---------------------------------------------------------------------------

def ban_user(db: Session, user: IptvUser) -> None:
    user.is_enabled = False
    db.query(UserConnection).filter(
        UserConnection.user_id == user.id,
        UserConnection.is_active == True,
    ).update({"is_active": False})
    db.add(user)
    db.commit()


def unban_user(db: Session, user: IptvUser) -> None:
    user.is_enabled = True
    db.add(user)
    db.commit()


def kill_all_connections(db: Session, user_id: int) -> int:
    result = db.query(UserConnection).filter(
        UserConnection.user_id == user_id,
        UserConnection.is_active == True,
    ).update({"is_active": False})
    db.commit()
    return result


def kill_connection(db: Session, conn_id: int) -> None:
    conn = db.query(UserConnection).filter(UserConnection.id == conn_id).first()
    if conn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bağlantı bulunamadı")
    conn.is_active = False
    db.add(conn)
    db.commit()


def reset_restrictions(db: Session, user: IptvUser) -> None:
    user.isp_lock_info = None
    user.allowed_ips = None
    user.forced_country = None
    db.add(user)
    db.commit()


# ---------------------------------------------------------------------------
# İzleme istatistikleri
# ---------------------------------------------------------------------------

def get_watch_stats(
    db: Session,
    user_id: int,
    page: int = 1,
    page_size: int = 50,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    query = db.query(UserWatchHistory).filter(UserWatchHistory.user_id == user_id)

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.filter(UserWatchHistory.started_at >= dt_from)
        except Exception:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            query = query.filter(UserWatchHistory.started_at <= dt_to)
        except Exception:
            pass

    total_count = query.count()

    total_duration = db.query(func.sum(UserWatchHistory.duration_seconds)).filter(
        UserWatchHistory.user_id == user_id
    ).scalar() or 0

    # En çok izlenen 5 kanal
    from sqlalchemy import desc
    top_streams_raw = (
        db.query(
            UserWatchHistory.stream_name,
            UserWatchHistory.stream_type,
            func.count(UserWatchHistory.id).label("watch_count"),
            func.sum(UserWatchHistory.duration_seconds).label("total_seconds"),
        )
        .filter(UserWatchHistory.user_id == user_id)
        .group_by(UserWatchHistory.stream_name, UserWatchHistory.stream_type)
        .order_by(desc("total_seconds"))
        .limit(5)
        .all()
    )
    top_streams = [
        {
            "stream_name": r.stream_name,
            "stream_type": r.stream_type,
            "watch_count": r.watch_count,
            "total_seconds": r.total_seconds or 0,
        }
        for r in top_streams_raw
    ]

    # Sayfalanmış geçmiş
    items = (
        query
        .order_by(UserWatchHistory.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    history = []
    for h in items:
        history.append({
            "id": h.id,
            "stream_id": h.stream_id,
            "stream_name": h.stream_name,
            "stream_type": h.stream_type,
            "ip_address": h.ip_address,
            "country_code": h.country_code,
            "isp_name": h.isp_name,
            "started_at": h.started_at.isoformat() if h.started_at else None,
            "ended_at": h.ended_at.isoformat() if h.ended_at else None,
            "duration_seconds": h.duration_seconds,
        })

    return {
        "total_count": total_count,
        "total_duration_seconds": int(total_duration),
        "top_streams": top_streams,
        "page": page,
        "page_size": page_size,
        "history": history,
    }
