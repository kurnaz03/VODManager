"""
Unit tests for GeoIP offline lookup (geoip.py).
Tests run without a real CSV file — they use a tiny in-memory data set injected
directly into the module's internal arrays.
"""
from __future__ import annotations

import importlib
from ipaddress import ip_address
from pathlib import Path
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Helpers to inject a tiny DB-IP-style dataset into the module
# ---------------------------------------------------------------------------

def _load_module():
    import app.modules.dashboard.geoip as g
    importlib.reload(g)          # reset _loaded + arrays between tests
    return g


def _inject_tr_range(geoip_mod):
    """
    Add a TR IPv4 range that covers 85.102.1.0/24.
    85.102.1.1 = int(ip_address("85.102.1.1")) = 1435467009
    We cover the whole /24: 85.102.1.0 – 85.102.1.255
    """
    start = int(ip_address("85.102.1.0"))
    end   = int(ip_address("85.102.1.255"))
    geoip_mod._ipv4_starts.append(start)
    geoip_mod._ipv4_ends.append(end)
    geoip_mod._ipv4_codes.append("TR")
    geoip_mod._loaded = True


# ---------------------------------------------------------------------------
# test_geoip_lookup_tr
# ---------------------------------------------------------------------------

def test_geoip_lookup_tr():
    g = _load_module()
    _inject_tr_range(g)
    result = g.lookup("85.102.1.1")
    assert result == "TR", f"Expected 'TR', got {result!r}"


# ---------------------------------------------------------------------------
# test_geoip_private_ip
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("ip", [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.100",
    "::1",
    "172.16.0.1",
    "172.31.255.255",
])
def test_geoip_private_ip(ip):
    g = _load_module()
    _inject_tr_range(g)
    assert g.lookup(ip) is None, f"Private IP {ip!r} should return None"


# ---------------------------------------------------------------------------
# test_geoip_invalid
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("ip", [
    "not-an-ip",
    "999.999.999.999",
    "",
    "abc",
])
def test_geoip_invalid(ip):
    g = _load_module()
    _inject_tr_range(g)
    assert g.lookup(ip) is None, f"Invalid IP {ip!r} should return None"


# ---------------------------------------------------------------------------
# test_geoip_not_loaded
# ---------------------------------------------------------------------------

def test_geoip_not_loaded():
    """When CSV is not loaded, lookup should return None (graceful)."""
    g = _load_module()
    # _loaded is False, arrays empty
    assert g.lookup("85.102.1.1") is None


# ---------------------------------------------------------------------------
# test_load_csv_missing_file
# ---------------------------------------------------------------------------

def test_load_csv_missing_file(tmp_path):
    """load_csv() with a non-existent file should log warning, not crash."""
    g = _load_module()
    non_existent = tmp_path / "no_such_file.csv"
    g.load_csv(path=non_existent)    # must not raise
    assert g._loaded is False


# ---------------------------------------------------------------------------
# test_load_csv_valid_content
# ---------------------------------------------------------------------------

def test_load_csv_valid_content(tmp_path):
    """load_csv() with a valid CSV should populate arrays and set _loaded=True."""
    g = _load_module()
    csv_file = tmp_path / "test.csv"
    csv_file.write_text(
        "85.102.1.0,85.102.1.255,TR\n"
        "8.8.8.0,8.8.8.255,US\n",
        encoding="utf-8",
    )
    g.load_csv(path=csv_file)
    assert g._loaded is True
    assert len(g._ipv4_starts) == 2
    assert g.lookup("85.102.1.1") == "TR"
    assert g.lookup("8.8.8.8") == "US"
