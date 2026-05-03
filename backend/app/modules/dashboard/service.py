from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.connections.models import UserConnection, UserWatchHistory
from app.modules.iptv_users.models import IptvUser
from app.modules.dashboard.schemas import (
    ConnectionDetail,
    CountryDetail,
    CountryStat,
    ViewerMapSummary,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Turkish country name mapping
# ---------------------------------------------------------------------------

_COUNTRY_NAMES_TR: dict[str, str] = {
    "TR": "Türkiye",
    "DE": "Almanya",
    "NL": "Hollanda",
    "FR": "Fransa",
    "GB": "İngiltere",
    "UK": "İngiltere",
    "US": "Amerika Birleşik Devletleri",
    "RU": "Rusya",
    "IT": "İtalya",
    "ES": "İspanya",
    "BE": "Belçika",
    "AT": "Avusturya",
    "CH": "İsviçre",
    "SE": "İsveç",
    "NO": "Norveç",
    "DK": "Danimarka",
    "FI": "Finlandiya",
    "PL": "Polonya",
    "CZ": "Çek Cumhuriyeti",
    "AU": "Avustralya",
    "CA": "Kanada",
    "JP": "Japonya",
    "CN": "Çin",
    "SA": "Suudi Arabistan",
    "AE": "Birleşik Arap Emirlikleri",
    "KW": "Kuveyt",
    "QA": "Katar",
    "BH": "Bahreyn",
    "OM": "Umman",
    "JO": "Ürdün",
    "LB": "Lübnan",
    "SY": "Suriye",
    "IQ": "Irak",
    "IR": "İran",
    "EG": "Mısır",
    "MA": "Fas",
    "DZ": "Cezayir",
    "TN": "Tunus",
    "LY": "Libya",
    "GR": "Yunanistan",
    "CY": "Kıbrıs",
    "RO": "Romanya",
    "BG": "Bulgaristan",
    "UA": "Ukrayna",
    "AZ": "Azerbaycan",
    "GE": "Gürcistan",
    "AM": "Ermenistan",
}


def get_country_name(code: str) -> str:
    return _COUNTRY_NAMES_TR.get(code.upper(), code.upper())


# ---------------------------------------------------------------------------
# Redis cache helpers
# ---------------------------------------------------------------------------

_TTL_MAP = {"now": 10, "24h": 120, "7d": 300}

try:
    import redis as redis_lib
    _redis_client = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:
    _redis_client = None  # type: ignore


def _cache_get(key: str) -> Any | None:
    if _redis_client is None:
        return None
    try:
        raw = _redis_client.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("Redis get error: %s", exc)
    return None


def _cache_set(key: str, data: Any, ttl: int) -> None:
    if _redis_client is None:
        return
    try:
        _redis_client.setex(key, ttl, json.dumps(data, default=str))
    except Exception as exc:
        logger.debug("Redis set error: %s", exc)


# ---------------------------------------------------------------------------
# Stale connection cleanup
# ---------------------------------------------------------------------------

def _expire_stale_connections(db: Session) -> None:
    """Mark connections as inactive if not seen in last 60 seconds."""
    threshold = datetime.now(timezone.utc) - timedelta(seconds=60)
    db.query(UserConnection).filter(
        UserConnection.is_active == True,  # noqa: E712
        UserConnection.last_seen_at < threshold,
    ).update({"is_active": False}, synchronize_session=False)
    db.flush()


# ---------------------------------------------------------------------------
# Viewer map summary
# ---------------------------------------------------------------------------

def get_viewer_map_summary(db: Session, time_range: str) -> ViewerMapSummary:
    cache_key = f"viewer_map:summary:{time_range}"
    cached = _cache_get(cache_key)
    if cached:
        return ViewerMapSummary(**cached)

    if time_range == "now":
        _expire_stale_connections(db)
        rows = (
            db.query(
                UserConnection.country_code,
                func.count(UserConnection.id).label("cnt"),
            )
            .filter(
                UserConnection.is_active == True,  # noqa: E712
                UserConnection.country_code.isnot(None),
                UserConnection.country_code != "",
            )
            .group_by(UserConnection.country_code)
            .order_by(func.count(UserConnection.id).desc())
            .all()
        )
    else:
        delta = timedelta(hours=24) if time_range == "24h" else timedelta(days=7)
        threshold = datetime.now(timezone.utc) - delta
        rows = (
            db.query(
                UserWatchHistory.country_code,
                func.count(UserWatchHistory.id).label("cnt"),
            )
            .filter(
                UserWatchHistory.started_at >= threshold,
                UserWatchHistory.country_code.isnot(None),
                UserWatchHistory.country_code != "",
            )
            .group_by(UserWatchHistory.country_code)
            .order_by(func.count(UserWatchHistory.id).desc())
            .all()
        )

    countries = [
        CountryStat(
            country_code=row.country_code.upper(),
            country_name=get_country_name(row.country_code),
            viewer_count=row.cnt,
        )
        for row in rows
        if row.country_code
    ]
    total = sum(c.viewer_count for c in countries)
    result = ViewerMapSummary(
        countries=countries,
        total_viewers=total,
        total_countries=len(countries),
    )
    _cache_set(cache_key, result.model_dump(), _TTL_MAP.get(time_range, 10))
    return result


# ---------------------------------------------------------------------------
# Country detail
# ---------------------------------------------------------------------------

def get_country_detail(db: Session, country_code: str, time_range: str) -> CountryDetail:
    cache_key = f"viewer_map:detail:{country_code}:{time_range}"
    cached = _cache_get(cache_key)
    if cached:
        return CountryDetail(**cached)

    connections: list[ConnectionDetail] = []

    if time_range == "now":
        _expire_stale_connections(db)
        rows = (
            db.query(UserConnection, IptvUser.username)
            .join(IptvUser, UserConnection.user_id == IptvUser.id)
            .filter(
                UserConnection.is_active == True,  # noqa: E712
                func.upper(UserConnection.country_code) == country_code.upper(),
            )
            .limit(100)
            .all()
        )
        now = datetime.now(timezone.utc)
        for conn, username in rows:
            started = conn.started_at
            if started and started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            duration = int((now - started).total_seconds()) if started else None
            connections.append(
                ConnectionDetail(
                    ip_address=conn.ip_address or "",
                    username=username or "",
                    stream_name=None,
                    stream_type=conn.stream_type,
                    started_at=started,
                    duration_seconds=duration,
                )
            )
    else:
        delta = timedelta(hours=24) if time_range == "24h" else timedelta(days=7)
        threshold = datetime.now(timezone.utc) - delta
        rows = (
            db.query(UserWatchHistory, IptvUser.username)
            .join(IptvUser, UserWatchHistory.user_id == IptvUser.id)
            .filter(
                UserWatchHistory.started_at >= threshold,
                func.upper(UserWatchHistory.country_code) == country_code.upper(),
            )
            .order_by(UserWatchHistory.started_at.desc())
            .limit(100)
            .all()
        )
        for wh, username in rows:
            started = wh.started_at
            if started and started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            connections.append(
                ConnectionDetail(
                    ip_address=wh.ip_address or "",
                    username=username or "",
                    stream_name=wh.stream_name,
                    stream_type=wh.stream_type,
                    started_at=started,
                    duration_seconds=wh.duration_seconds,
                )
            )

    result = CountryDetail(
        country_code=country_code.upper(),
        country_name=get_country_name(country_code),
        connections=connections,
        total=len(connections),
    )
    _cache_set(cache_key, result.model_dump(), _TTL_MAP.get(time_range, 10))
    return result
