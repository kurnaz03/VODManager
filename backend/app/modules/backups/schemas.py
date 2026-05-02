from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.modules.backups.models import BackupStatus, BackupType


class BackupResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_size_bytes: Optional[int] = None
    backup_type: BackupType
    status: BackupStatus
    task_id: Optional[str] = None
    progress_percent: int
    error_message: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BackupListResponse(BaseModel):
    backups: list[BackupResponse]
    total: int


class RestoreRequest(BaseModel):
    confirm: bool


class MaintenanceStatusResponse(BaseModel):
    maintenance_mode: bool
