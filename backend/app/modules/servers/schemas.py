from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


class ServerCheckPayload(BaseModel):
    """SSH baglanti testi icin – name gerektirmez, fazla alanlar goz ardi edilir."""
    model_config = ConfigDict(extra="ignore")

    ip_address: IPvAnyAddress
    ssh_port: int = Field(default=22, ge=1, le=65535)
    ssh_username: str = Field(min_length=1, max_length=120)
    ssh_password: str = Field(min_length=1, max_length=500)


class ServerConnectionPayload(ServerCheckPayload):
    name: str = Field(min_length=2, max_length=120)


class ServerCreate(ServerConnectionPayload):
    pass


class ServerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    ip_address: str | None = Field(default=None, min_length=7, max_length=45)
    ssh_port: int | None = Field(default=None, ge=1, le=65535)
    ssh_username: str | None = Field(default=None, min_length=1, max_length=120)
    ssh_password: str | None = Field(default=None, min_length=1, max_length=500)
    domain_name: str | None = Field(default=None, max_length=255)
    max_clients: int | None = Field(default=None, ge=1)
    network_interface: str | None = Field(default=None, max_length=64)
    network_speed: int | None = Field(default=None, ge=1)
    http_port: int | None = Field(default=None, ge=1, le=65535)
    https_port: int | None = Field(default=None, ge=1, le=65535)
    rtmp_port: int | None = Field(default=None, ge=1, le=65535)


class ServerMetricResponse(BaseModel):
    id: int
    cpu_percent: float
    ram_percent: float
    ram_used: int
    disk_percent: float
    disk_used: int
    network_in_mbps: float
    network_out_mbps: float
    active_connections: int
    collected_at: datetime

    model_config = {"from_attributes": True}


class InstallLogResponse(BaseModel):
    id: int
    step: str
    status: str
    message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ServerResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    ssh_port: int
    ssh_username: str
    server_type: str
    status: str
    os_info: str | None
    cpu_info: str | None
    ram_total: int | None
    disk_total: int | None
    domain_name: str | None
    max_clients: int | None
    network_interface: str | None
    network_speed: int | None
    http_port: int | None
    https_port: int | None
    rtmp_port: int | None
    created_at: datetime
    updated_at: datetime | None
    latest_metric: ServerMetricResponse | None = None

    model_config = {"from_attributes": True}


class ServerInstallStatusResponse(BaseModel):
    server_id: int
    status: str
    progress_percent: int
    total_steps: int
    completed_steps: int
    running_step: str | None
    logs: list[InstallLogResponse]


class ServerCheckResponse(BaseModel):
    ok: bool
    message: str
    os_info: str | None = None
    cpu_info: str | None = None
    ram_total: int | None = None
    disk_total: int | None = None