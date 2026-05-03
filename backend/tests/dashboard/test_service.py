"""
Unit tests for dashboard service (viewer map summary + country detail + cache).
Uses SQLite in-memory DB so no real Postgres is needed.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.connections.models import UserConnection, UserWatchHistory
from app.modules.iptv_users.models import IptvUser


# ---------------------------------------------------------------------------
# SQLite in-memory engine
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, username="testuser") -> IptvUser:
    user = IptvUser(
        username=username,
        password="hashed",
        is_enabled=True,
        max_connections=5,
    )
    db.add(user)
    db.flush()
    return user


def _make_conn(db, user, *, country_code="TR", active=True, offset_seconds=0) -> UserConnection:
    now = datetime.now(timezone.utc) - timedelta(seconds=offset_seconds)
    conn = UserConnection(
        user_id=user.id,
        ip_address="85.102.1.1",
        country_code=country_code,
        started_at=now,
        last_seen_at=now,
        is_active=active,
    )
    db.add(conn)
    db.flush()
    return conn


def _make_wh(db, user, *, country_code="TR", hours_ago=1) -> UserWatchHistory:
    started = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    wh = UserWatchHistory(
        user_id=user.id,
        stream_name="Test Channel",
        stream_type="live",
        ip_address="85.102.1.1",
        country_code=country_code,
        started_at=started,
        duration_seconds=120,
    )
    db.add(wh)
    db.flush()
    return wh


# ---------------------------------------------------------------------------
# test_viewer_map_summary_now
# ---------------------------------------------------------------------------

def test_viewer_map_summary_now(db):
    """get_viewer_map_summary('now') should aggregate active user_connections by country."""
    user = _make_user(db, "user_now")
    # Fresh active connection
    _make_conn(db, user, country_code="TR", active=True, offset_seconds=5)
    db.commit()

    with patch("app.modules.dashboard.service._cache_get", return_value=None), \
         patch("app.modules.dashboard.service._cache_set"):
        from app.modules.dashboard.service import get_viewer_map_summary
        result = get_viewer_map_summary(db, "now")

    assert result.total_viewers >= 1
    codes = [c.country_code for c in result.countries]
    assert "TR" in codes


# ---------------------------------------------------------------------------
# test_viewer_map_summary_24h
# ---------------------------------------------------------------------------

def test_viewer_map_summary_24h(db):
    """get_viewer_map_summary('24h') should aggregate user_watch_history within last 24h."""
    user = _make_user(db, "user_24h")
    _make_wh(db, user, country_code="DE", hours_ago=2)
    db.commit()

    with patch("app.modules.dashboard.service._cache_get", return_value=None), \
         patch("app.modules.dashboard.service._cache_set"):
        from app.modules.dashboard.service import get_viewer_map_summary
        result = get_viewer_map_summary(db, "24h")

    assert result.total_viewers >= 1
    codes = [c.country_code for c in result.countries]
    assert "DE" in codes


# ---------------------------------------------------------------------------
# test_country_detail_tr
# ---------------------------------------------------------------------------

def test_country_detail_tr(db):
    """get_country_detail returns max 100 connections for the given country code."""
    user = _make_user(db, "user_detail")
    for i in range(5):
        _make_conn(db, user, country_code="TR", active=True, offset_seconds=i)
    db.commit()

    with patch("app.modules.dashboard.service._cache_get", return_value=None), \
         patch("app.modules.dashboard.service._cache_set"):
        from app.modules.dashboard.service import get_country_detail
        result = get_country_detail(db, "TR", "now")

    assert result.country_code == "TR"
    assert result.total >= 5
    assert len(result.connections) <= 100


# ---------------------------------------------------------------------------
# test_cache_hit
# ---------------------------------------------------------------------------

def test_cache_hit(db):
    """Second call should use cached value (DB not queried again)."""
    cached_payload = {
        "countries": [{"country_code": "US", "country_name": "Amerika Birleşik Devletleri", "viewer_count": 42}],
        "total_viewers": 42,
        "total_countries": 1,
    }

    with patch("app.modules.dashboard.service._cache_get", return_value=cached_payload) as mock_get, \
         patch("app.modules.dashboard.service._cache_set") as mock_set:
        from app.modules.dashboard.service import get_viewer_map_summary
        result = get_viewer_map_summary(db, "now")

    mock_get.assert_called_once()
    mock_set.assert_not_called()          # no write when cache hit
    assert result.total_viewers == 42
    assert result.countries[0].country_code == "US"


# ---------------------------------------------------------------------------
# test_stale_connection_cleanup
# ---------------------------------------------------------------------------

def test_stale_connection_cleanup(db):
    """Connections not seen for >60s should be set is_active=False."""
    user = _make_user(db, "user_stale")
    # Stale connection: last_seen_at = 2 minutes ago
    stale = _make_conn(db, user, country_code="TR", active=True, offset_seconds=120)
    db.commit()

    with patch("app.modules.dashboard.service._cache_get", return_value=None), \
         patch("app.modules.dashboard.service._cache_set"):
        from app.modules.dashboard.service import get_viewer_map_summary
        get_viewer_map_summary(db, "now")

    db.refresh(stale)
    assert stale.is_active is False
