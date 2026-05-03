from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CountryStat(BaseModel):
    country_code: str
    country_name: str
    viewer_count: int


class ViewerMapSummary(BaseModel):
    countries: List[CountryStat]
    total_viewers: int
    total_countries: int


class ConnectionDetail(BaseModel):
    ip_address: str
    username: str
    stream_name: Optional[str] = None
    stream_type: Optional[str] = None
    started_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class CountryDetail(BaseModel):
    country_code: str
    country_name: str
    connections: List[ConnectionDetail]
    total: int
