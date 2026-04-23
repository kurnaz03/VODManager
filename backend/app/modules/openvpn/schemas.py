from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class VpnClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    description: str | None = Field(default=None, max_length=500)


class VpnClientResponse(BaseModel):
    id: int
    name: str
    description: str | None
    user_id: int | None
    cert_path: str | None
    key_path: str | None
    ovpn_path: str | None
    is_active: bool
    created_at: datetime
    expires_at: datetime | None

    class Config:
        from_attributes = True


class VpnClientList(BaseModel):
    items: list[VpnClientResponse]
    total: int


class VpnServerConfigResponse(BaseModel):
    id: int
    server_ip: str
    server_port: int
    protocol: Literal["udp", "tcp"]
    ca_cert_path: str
    server_cert_path: str
    server_key_path: str
    dh_params_path: str
    ta_key_path: str
    easy_rsa_dir: str
    clients_dir: str
    updated_at: datetime

    class Config:
        from_attributes = True


class VpnServerConfigUpdate(BaseModel):
    server_ip: str = Field(min_length=7, max_length=100)
    server_port: int = Field(ge=1, le=65535)
    protocol: Literal["udp", "tcp"] = "udp"
    ca_cert_path: str = Field(max_length=500)
    server_cert_path: str = Field(max_length=500)
    server_key_path: str = Field(max_length=500)
    dh_params_path: str = Field(max_length=500)
    ta_key_path: str = Field(max_length=500)
    easy_rsa_dir: str = Field(max_length=500)
    clients_dir: str = Field(max_length=500)
