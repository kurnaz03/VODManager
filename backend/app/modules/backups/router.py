from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.backups.dependencies import require_admin
from app.modules.backups import service
from app.modules.backups.schemas import (
    BackupListResponse,
    BackupResponse,
    MaintenanceStatusResponse,
    RestoreRequest,
)

router = APIRouter(
    prefix="/backups",
    tags=["backups"],
    dependencies=[Depends(get_current_user_id), Depends(require_admin)],
)


# NOTE: maintenance-status must be defined BEFORE /{backup_id} routes
# to prevent FastAPI from trying to parse the literal string as a UUID.


@router.get("/maintenance-status", response_model=MaintenanceStatusResponse)
def maintenance_status():
    return service.get_maintenance_status()


@router.get("", response_model=BackupListResponse)
def list_backups(db: Session = Depends(get_db)):
    return service.list_backups(db)


@router.post("", response_model=BackupResponse, status_code=status.HTTP_202_ACCEPTED)
def create_backup(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.trigger_manual_backup(db, user_id)


@router.get("/{backup_id}", response_model=BackupResponse)
def get_backup(backup_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_backup(db, backup_id)


@router.get("/{backup_id}/download")
def download_backup(backup_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.download_backup(db, backup_id)


@router.post(
    "/{backup_id}/restore",
    response_model=BackupResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def restore_backup(
    backup_id: uuid.UUID,
    body: RestoreRequest,
    request: Request,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if not body.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm alani true olmali",
        )
    # Rate limit: max 1 restore per hour via Redis counter
    _check_restore_rate_limit(request)
    return service.trigger_restore(db, backup_id, user_id)


def _check_restore_rate_limit(request: Request) -> None:
    """Simple Redis-based per-IP restore rate limit: 1 per hour."""
    import redis as redis_lib
    from app.core.config import settings

    try:
        r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
        client_ip = request.client.host if request.client else "unknown"
        key = f"restore_ratelimit:{client_ip}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 3600)
        if count > 1:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Saatte yalnizca 1 geri yukleme yapilabilir.",
                headers={"Retry-After": "3600"},
            )
    except HTTPException:
        raise
    except Exception:
        # If Redis unavailable, allow the request
        pass


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup(backup_id: uuid.UUID, db: Session = Depends(get_db)):
    service.delete_backup(db, backup_id)
