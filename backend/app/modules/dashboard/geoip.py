"""
Offline GeoIP lookup using DB-IP Country Lite CSV.

CSV path: /var/www/vod-manager/data/dbip-country-lite.csv
Download: https://download.db-ip.com/free/dbip-country-lite-YYYY-MM.csv.gz

Load once at startup via load_csv(), then call lookup(ip) for O(log n) lookups.
"""

from __future__ import annotations

import csv
import gzip
import bisect
import logging
from ipaddress import ip_address, IPv4Address, IPv6Address
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CSV_PATH = Path("/var/www/vod-manager/data/dbip-country-lite.csv")

_PRIVATE_PREFIXES = ("127.", "10.", "192.168.", "::1", "0.0.0.0", "169.254.")
_PRIVATE_RANGES_172 = (16, 31)  # 172.16.x.x – 172.31.x.x

# Parallel sorted arrays for IPv4 and IPv6 separately
_ipv4_starts: list[int] = []
_ipv4_ends: list[int] = []
_ipv4_codes: list[str] = []

_ipv6_starts: list[int] = []
_ipv6_ends: list[int] = []
_ipv6_codes: list[str] = []

_loaded = False


def _is_private(ip: str) -> bool:
    if any(ip.startswith(p) for p in _PRIVATE_PREFIXES):
        return True
    if ip.startswith("172."):
        parts = ip.split(".")
        if len(parts) >= 2:
            try:
                second = int(parts[1])
                if _PRIVATE_RANGES_172[0] <= second <= _PRIVATE_RANGES_172[1]:
                    return True
            except ValueError:
                pass
    return False


def load_csv(path: Path | None = None) -> None:
    """Parse DB-IP Lite CSV into sorted in-memory lookup arrays."""
    global _loaded
    target = path or CSV_PATH

    if not target.exists():
        logger.warning(
            "DB-IP CSV not found at %s — GeoIP lookups will return None. "
            "Download from https://download.db-ip.com/free/dbip-country-lite-<YYYY-MM>.csv.gz",
            target,
        )
        return

    open_fn = gzip.open if str(target).endswith(".gz") else open
    count = 0
    errors = 0

    try:
        with open_fn(str(target), "rt", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 3:
                    continue
                try:
                    start_ip = ip_address(row[0])
                    end_ip = ip_address(row[1])
                    code = row[2].strip().upper()
                    if not code:
                        continue

                    if isinstance(start_ip, IPv4Address):
                        _ipv4_starts.append(int(start_ip))
                        _ipv4_ends.append(int(end_ip))
                        _ipv4_codes.append(code)
                    else:
                        _ipv6_starts.append(int(start_ip))
                        _ipv6_ends.append(int(end_ip))
                        _ipv6_codes.append(code)
                    count += 1
                except (ValueError, TypeError):
                    errors += 1

        _loaded = True
        logger.info("DB-IP CSV loaded: %d records (%d errors)", count, errors)
    except Exception as exc:
        logger.error("Failed to load DB-IP CSV from %s: %s", target, exc)


def lookup(ip: str) -> Optional[str]:
    """
    Return 2-letter ISO country code for an IP address.
    Returns None for private IPs, unknown IPs, or if CSV not loaded.
    """
    if not _loaded:
        return None
    if _is_private(ip):
        return None

    try:
        parsed = ip_address(ip)
        n = int(parsed)
    except ValueError:
        return None

    if isinstance(parsed, IPv4Address):
        starts, ends, codes = _ipv4_starts, _ipv4_ends, _ipv4_codes
    else:
        starts, ends, codes = _ipv6_starts, _ipv6_ends, _ipv6_codes

    idx = bisect.bisect_right(starts, n) - 1
    if idx >= 0 and ends[idx] >= n:
        return codes[idx]
    return None
