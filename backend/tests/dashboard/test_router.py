"""
Unit tests for dashboard router — authentication guard.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


def test_unauthenticated_viewer_map(client):
    """GET /api/v1/dashboard/viewer-map without a token must return 401."""
    resp = client.get("/api/v1/dashboard/viewer-map")
    assert resp.status_code == 401


def test_unauthenticated_country_detail(client):
    """GET /api/v1/dashboard/viewer-map/TR without a token must return 401."""
    resp = client.get("/api/v1/dashboard/viewer-map/TR")
    assert resp.status_code == 401
