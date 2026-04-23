from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ForcedConnectionLiteral = Literal["disabled", "forced_on", "forced_off"]


class IptvUserCreate(BaseModel):
    username: str | None = Field(default=None, max_length=100)
    password: str | None = Field(default=None, max_length=100)
    owner: str = Field(default="admin", max_length=100)
    max_connections: int = Field(default=1, ge=0)
    is_trial: bool = False
    is_enabled: bool = True
    expiry_date: datetime | None = None
    admin_notes: str | None = None
    reseller_notes: str | None = None

    # Advanced
    forced_connection: ForcedConnectionLiteral = "disabled"
    is_restreamer: bool = False
    forced_country: str | None = None
    isp_lock_info: str | None = None
    access_hls: bool = True
    access_mpegts: bool = True
    access_rtmp: bool = True

    # Restrictions
    allowed_ips: list[str] = Field(default_factory=list)
    allowed_user_agents: list[str] = Field(default_factory=list)

    # Bouquets
    bouquet_ids: list[int] = Field(default_factory=list)


class IptvUserUpdate(BaseModel):
    username: str | None = Field(default=None, max_length=100)
    password: str | None = Field(default=None, max_length=100)
    owner: str | None = Field(default=None, max_length=100)
    max_connections: int | None = Field(default=None, ge=0)
    is_trial: bool | None = None
    is_enabled: bool | None = None
    expiry_date: datetime | None = None
    admin_notes: str | None = None
    reseller_notes: str | None = None

    forced_connection: ForcedConnectionLiteral | None = None
    is_restreamer: bool | None = None
    forced_country: str | None = None
    isp_lock_info: str | None = None
    access_hls: bool | None = None
    access_mpegts: bool | None = None
    access_rtmp: bool | None = None

    allowed_ips: list[str] | None = None
    allowed_user_agents: list[str] | None = None

    bouquet_ids: list[int] | None = None


class BouquetBrief(BaseModel):
    id: int
    name: str
    item_count: int


class IptvUserResponse(BaseModel):
    id: int
    username: str
    password: str
    owner: str
    max_connections: int
    is_trial: bool
    is_enabled: bool
    created_at: datetime
    expiry_date: datetime | None

    admin_notes: str | None
    reseller_notes: str | None

    forced_connection: str
    is_restreamer: bool
    forced_country: str | None
    isp_lock_info: str | None
    access_hls: bool
    access_mpegts: bool
    access_rtmp: bool

    allowed_ips: list[str]
    allowed_user_agents: list[str]

    active_connections: int = 0

    last_ip: str | None = None
    last_isp: str | None = None
    last_country_code: str | None = None

    bouquets: list[BouquetBrief]

    model_config = {"from_attributes": True}


class BouquetAssign(BaseModel):
    bouquet_id: int = Field(ge=1)
