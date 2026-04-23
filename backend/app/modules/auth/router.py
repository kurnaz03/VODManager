from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.modules.auth import service
from app.modules.auth.schemas import (
    SetupStatusResponse,
    InitialAdminCreate,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserMeResponse,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserResponse,
    ChangePasswordRequest,
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token gerekli")
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gecersiz token")
    return int(payload["sub"])


# Setup endpoints
@router.get("/setup/status", response_model=SetupStatusResponse, tags=["setup"])
def setup_status(db: Session = Depends(get_db)):
    return service.get_setup_status(db)


@router.post("/setup/initial-admin", tags=["setup"])
def create_initial_admin(
    data: InitialAdminCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return service.create_initial_admin(db, data, ip=ip, user_agent=ua)


# Auth endpoints
@router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return service.login(db, data, ip=ip, user_agent=ua)


@router.post("/auth/refresh", response_model=TokenResponse, tags=["auth"])
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    return service.refresh(db, data.refresh_token)


@router.post("/auth/logout", tags=["auth"])
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    return service.logout(db, data.refresh_token)


@router.get("/auth/me", response_model=UserMeResponse, tags=["auth"])
def get_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.get_me(db, user_id)


@router.put("/auth/change-password", tags=["auth"])
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.change_password(db, user_id, data)


# Admin user management
@router.get("/auth/users", tags=["admin"])
def list_admin_users(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.list_admin_users(db)


@router.post("/auth/users", response_model=AdminUserResponse, tags=["admin"])
def create_admin_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.create_admin_user(db, data)


@router.put("/auth/users/{target_id}", response_model=AdminUserResponse, tags=["admin"])
def update_admin_user(
    target_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.update_admin_user(db, target_id, data)


@router.delete("/auth/users/{target_id}", tags=["admin"])
def delete_admin_user(
    target_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.delete_admin_user(db, target_id, current_user_id=user_id)


# Dashboard
@router.get("/admin/dashboard", tags=["admin"])
def dashboard(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    from app.modules.users.models import User, ActivityLog
    from app.modules.servers.models import Server
    from app.modules.content.models import MovieCategory, SeriesCategory, TvCategory, RadioCategory
    import os

    total_users = db.query(User).count()
    total_servers = db.query(Server).count()
    total_categories = (
        db.query(MovieCategory).count()
        + db.query(SeriesCategory).count()
        + db.query(TvCategory).count()
        + db.query(RadioCategory).count()
    )

    uptime_seconds = 0
    try:
        with open("/proc/uptime") as f:
            uptime_seconds = int(float(f.read().split()[0]))
    except Exception:
        uptime_seconds = 0

    recent_logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(5)
        .all()
    )
    return {
        "total_users": total_users,
        "total_servers": total_servers,
        "total_categories": total_categories,
        "uptime_seconds": uptime_seconds,
        "recent_activity": [
            {
                "action": log.action,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent_logs
        ],
    }

