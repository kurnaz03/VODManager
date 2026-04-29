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
    from app.modules.servers.models import Server, ServerMetric
    from app.modules.content.models import (
        MovieCategory, SeriesCategory, TvCategory, RadioCategory,
        Bouquet, SeriesContent, MovieContent, TvContent, RadioContent,
    )
    from app.modules.tv.models import TvChannel
    from app.modules.playlist.models import Playlist
    from app.modules.tv.viewer_tracker import viewer_tracker
    from sqlalchemy import func as sqlfunc
    import os

    total_users = db.query(User).count()
    total_servers = db.query(Server).count()
    total_categories = (
        db.query(MovieCategory).count()
        + db.query(SeriesCategory).count()
        + db.query(TvCategory).count()
        + db.query(RadioCategory).count()
    )
    total_bouquets = db.query(Bouquet).count()
    total_series = db.query(SeriesContent).count()
    total_movies = db.query(MovieContent).count()
    total_tv_channels = db.query(TvChannel).count()
    total_radio = db.query(RadioContent).count()

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

    # Online users from viewer tracker
    online_users = sum(viewer_tracker.get_all_counts().values())

    # Total network in/out across all servers (latest metric per server)
    servers_list = db.query(Server).all()
    total_net_in = 0.0
    total_net_out = 0.0
    for srv in servers_list:
        latest = (
            db.query(ServerMetric)
            .filter(ServerMetric.server_id == srv.id)
            .order_by(ServerMetric.collected_at.desc())
            .first()
        )
        if latest:
            total_net_in += latest.network_in_mbps or 0.0
            total_net_out += latest.network_out_mbps or 0.0

    # Online / offline TV streams
    online_streams = db.query(TvChannel).filter(TvChannel.is_active == True).count()
    offline_streams = db.query(TvChannel).filter(TvChannel.is_active == False).count()

    # Online VOD channels (playlists with status = 'playing')
    online_vod = db.query(Playlist).filter(Playlist.status == "playing").count()

    return {
        "total_users": total_users,
        "total_servers": total_servers,
        "total_categories": total_categories,
        "total_bouquets": total_bouquets,
        "total_series": total_series,
        "total_movies": total_movies,
        "total_tv_channels": total_tv_channels,
        "total_radio": total_radio,
        "uptime_seconds": uptime_seconds,
        "online_users": online_users,
        "total_net_in_mbps": total_net_in,
        "total_net_out_mbps": total_net_out,
        "online_streams": online_streams,
        "offline_streams": offline_streams,
        "online_vod_channels": online_vod,
        "recent_activity": [
            {
                "action": log.action,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent_logs
        ],
    }

