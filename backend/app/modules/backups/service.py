from __future__ import annotations

import uuid
from datetime import datetime, timezone

import redis as redis_lib
from fastapi import HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.backups.models import Backup, BackupStatus, BackupType
from app.modules.backups.storage import backup_path, check_disk_space, make_filename

_redis = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
MAINTENANCE_KEY = "maintenance_mode"


# ── Maintenance helpers ──────────────────────────────────────────────────────

def set_maintenance_mode(enabled: bool) -> None:
    try:
        if enabled:
            _redis.set(MAINTENANCE_KEY, "1")
        else:
            _redis.delete(MAINTENANCE_KEY)
    except Exception:
        pass  # fail open — if Redis unavailable, maintenance state just won't persist


def is_maintenance_mode() -> bool:
    try:
        return _redis.get(MAINTENANCE_KEY) == "1"
    except Exception:
        return False


def get_maintenance_status() -> dict:
    return {"maintenance_mode": is_maintenance_mode()}


# ── Guard ────────────────────────────────────────────────────────────────────

def _assert_no_active_operation(db: Session) -> None:
    active = (
        db.query(Backup)
        .filter(Backup.status.in_([BackupStatus.running, BackupStatus.restoring]))
        .first()
    )
    if active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aktif bir yedekleme/geri yukleme islemi suruyor. Lutfen bekleyin.",
        )


# ── CRUD helpers ─────────────────────────────────────────────────────────────

def list_backups(db: Session) -> dict:
    items = db.query(Backup).order_by(Backup.created_at.desc()).all()
    return {"backups": items, "total": len(items)}


def get_backup(db: Session, backup_id: uuid.UUID) -> Backup:
    b = db.query(Backup).filter(Backup.id == backup_id).first()
    if b is None:
        raise HTTPException(status_code=404, detail="Yedek bulunamadi")
    return b


# ── Trigger manual backup ────────────────────────────────────────────────────

def trigger_manual_backup(db: Session, user_id: int) -> Backup:
    _assert_no_active_operation(db)
    check_disk_space()

    ts = datetime.now(timezone.utc)
    filename = make_filename(ts)

    record = Backup(
        filename=filename,
        backup_type=BackupType.manual,
        status=BackupStatus.pending,
        created_by=user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    from app.modules.backups.tasks import create_backup_task  # avoid circular

    task = create_backup_task.delay(str(record.id))
    record.task_id = task.id
    db.commit()
    db.refresh(record)
    return record


# ── Trigger restore ──────────────────────────────────────────────────────────

def trigger_restore(db: Session, backup_id: uuid.UUID, user_id: int) -> Backup:
    target = get_backup(db, backup_id)
    if target.status != BackupStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yalnizca tamamlanmis yedekler geri yuklenebilir.",
        )
    _assert_no_active_operation(db)
    check_disk_space()

    ts = datetime.now(timezone.utc)
    snap_filename = f"pre-restore-{ts.strftime('%Y%m%d-%H%M%S')}.tar.gz"

    snap = Backup(
        filename=snap_filename,
        backup_type=BackupType.pre_restore,
        status=BackupStatus.pending,
        restore_target_id=backup_id,
        created_by=user_id,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)

    set_maintenance_mode(True)

    from app.modules.backups.tasks import restore_backup_task  # avoid circular

    try:
        task = restore_backup_task.delay(str(snap.id), str(backup_id))
    except Exception as exc:
        # Celery broker unavailable — roll back
        set_maintenance_mode(False)
        db.delete(snap)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gorev kuyrugu kullanilamıyor, geri yukleme başlatılamadı: {exc}",
        )

    snap.task_id = task.id
    db.commit()
    db.refresh(snap)
    return snap


# ── Download ─────────────────────────────────────────────────────────────────

def download_backup(db: Session, backup_id: uuid.UUID) -> FileResponse:
    b = get_backup(db, backup_id)
    if b.status != BackupStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yedek henuz tamamlanmadi veya basarisiz.",
        )
    path = backup_path(b.filename)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Yedek dosyasi diskte bulunamadi.",
        )
    return FileResponse(
        path=str(path),
        media_type="application/gzip",
        filename=b.filename,
        headers={"Content-Disposition": f'attachment; filename="{b.filename}"'},
    )


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_backup(db: Session, backup_id: uuid.UUID) -> None:
    b = get_backup(db, backup_id)
    if b.status in {BackupStatus.running, BackupStatus.restoring}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aktif islem sirasinda yedek silinemez.",
        )
    path = backup_path(b.filename)
    if path.exists():
        path.unlink()
    db.delete(b)
    db.commit()
