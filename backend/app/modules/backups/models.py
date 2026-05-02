import enum
import uuid

from sqlalchemy import BigInteger, Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class BackupType(str, enum.Enum):
    manual = "manual"
    auto = "auto"
    pre_restore = "pre_restore"


class BackupStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    restoring = "restoring"


class Backup(Base):
    __tablename__ = "backups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    file_path = Column(String(1000), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    backup_type = Column(Enum(BackupType), nullable=False, index=True)
    status = Column(
        Enum(BackupStatus),
        nullable=False,
        default=BackupStatus.pending,
        index=True,
    )
    task_id = Column(String(255), nullable=True, index=True)
    progress_percent = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    restore_target_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(Integer, nullable=True, index=True)
    manifest_json = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
