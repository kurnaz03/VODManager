from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime


# ── Server Assignment ─────────────────────────────────────────────────────────

class TvChannelServerCreate(BaseModel):
    server_id: int
    is_active: bool = True
    priority: int = 0


class TvChannelServerOut(BaseModel):
    id: int
    tv_channel_id: int
    server_id: int
    server_name: Optional[str] = None
    server_ip: Optional[str] = None
    is_active: bool
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Bouquet Assignment ────────────────────────────────────────────────────────

class TvChannelBouquetCreate(BaseModel):
    bouquet_id: int
    position: int = 0


class TvChannelBouquetOut(BaseModel):
    id: int
    tv_channel_id: int
    bouquet_id: int
    bouquet_name: Optional[str] = None
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── TvChannel CRUD ─────────────────────────────────────────────────────────────

class TvChannelCreate(BaseModel):
    name: str
    logo_url: Optional[str] = None
    epg_channel_id: Optional[str] = None
    stream_url: str
    category_id: Optional[int] = None
    is_active: bool = True
    sort_order: int = 0
    server_ids: List[int] = []
    bouquet_ids: List[int] = []
    backup_urls: List[str] = []
    on_demand: bool = False
    on_demand_timeout: int = 30
    on_demand_server_id: Optional[int] = None


class TvChannelUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    epg_channel_id: Optional[str] = None
    stream_url: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    server_ids: Optional[List[int]] = None
    bouquet_ids: Optional[List[int]] = None
    backup_urls: Optional[List[str]] = None
    on_demand: Optional[bool] = None
    on_demand_timeout: Optional[int] = None
    on_demand_server_id: Optional[int] = None


class TvChannelOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str]
    epg_channel_id: Optional[str]
    stream_url: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    is_active: bool
    sort_order: int
    backup_urls: List[str] = []
    on_demand: bool
    on_demand_timeout: int
    on_demand_server_id: Optional[int]
    on_demand_server_name: Optional[str] = None
    started_at: Optional[str] = None
    uptime_seconds: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    servers: List[TvChannelServerOut] = []
    bouquet_assignments: List[TvChannelBouquetOut] = []

    class Config:
        from_attributes = True


class TvChannelTestResult(BaseModel):
    channel_id: int
    stream_url: str
    ok: bool
    status_code: Optional[int] = None
    message: str


# ── Viewer Tracking ───────────────────────────────────────────────────────────

class ViewerOut(BaseModel):
    username: str
    ip_address: str
    connected_at: float
    duration_seconds: int


class ChannelViewerCounts(BaseModel):
    counts: Dict[int, int]  # channel_id -> viewer count
