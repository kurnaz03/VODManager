from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.iptv_users import service
from app.modules.iptv_users.models import IptvUser
from app.modules.iptv_users.schemas import (
    BouquetAssign,
    IptvUserCreate,
    IptvUserResponse,
    IptvUserUpdate,
)
from app.modules.connections import service as conn_svc

router = APIRouter(prefix="/iptv-users", tags=["iptv-users"], dependencies=[Depends(get_current_user_id)])


@router.get("", response_model=list[IptvUserResponse])
def list_users(search: str | None = Query(default=None), db: Session = Depends(get_db)):
    return service.list_users(db, search)


@router.post("", response_model=IptvUserResponse, status_code=201)
def create_user(payload: IptvUserCreate, db: Session = Depends(get_db)):
    return service.create_user(db, payload)


@router.get("/{user_id}", response_model=IptvUserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return service.get_user(db, user_id)


@router.put("/{user_id}", response_model=IptvUserResponse)
def update_user(user_id: int, payload: IptvUserUpdate, db: Session = Depends(get_db)):
    return service.update_user(db, user_id, payload)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    service.delete_user(db, user_id)


@router.get("/{user_id}/m3u", response_class=PlainTextResponse)
def get_m3u(user_id: int, fmt: str = Query(default="m3u_plus"), request: Request = None, db: Session = Depends(get_db)):
    host = request.headers.get("host", "localhost") if request else "localhost"
    content = service.generate_m3u(db, user_id, host, fmt)
    return PlainTextResponse(content=content, media_type="audio/x-mpegurl",
                              headers={"Content-Disposition": f"attachment; filename=playlist_{user_id}.m3u"})


@router.post("/{user_id}/bouquets", response_model=IptvUserResponse)
def assign_bouquet(user_id: int, payload: BouquetAssign, db: Session = Depends(get_db)):
    return service.assign_bouquet(db, user_id, payload.bouquet_id)


@router.delete("/{user_id}/bouquets/{bouquet_id}", status_code=204)
def unassign_bouquet(user_id: int, bouquet_id: int, db: Session = Depends(get_db)):
    service.unassign_bouquet(db, user_id, bouquet_id)


# ─── Aktif bağlantılar ────────────────────────────────────────────────────────

@router.get("/{user_id}/connections")
def get_connections(user_id: int, db: Session = Depends(get_db)):
    _load_or_404(db, user_id)
    return conn_svc.get_active_connections(db, user_id)


# ─── Ban / Unban ──────────────────────────────────────────────────────────────

@router.post("/{user_id}/ban", status_code=200)
def ban_user(user_id: int, db: Session = Depends(get_db)):
    user = _load_or_404(db, user_id)
    conn_svc.ban_user(db, user)
    return {"detail": "Kullanici banlandı"}


@router.post("/{user_id}/unban", status_code=200)
def unban_user(user_id: int, db: Session = Depends(get_db)):
    user = _load_or_404(db, user_id)
    conn_svc.unban_user(db, user)
    return {"detail": "Ban kaldırıldı"}


# ─── Kill connections ─────────────────────────────────────────────────────────

@router.post("/{user_id}/kill", status_code=200)
def kill_all(user_id: int, db: Session = Depends(get_db)):
    _load_or_404(db, user_id)
    killed = conn_svc.kill_all_connections(db, user_id)
    return {"detail": f"{killed} bağlantı kesildi"}


@router.post("/{user_id}/kill-connection/{conn_id}", status_code=200)
def kill_connection(user_id: int, conn_id: int, db: Session = Depends(get_db)):
    _load_or_404(db, user_id)
    conn_svc.kill_connection(db, conn_id)
    return {"detail": "Bağlantı kesildi"}


# ─── Reset restrictions ───────────────────────────────────────────────────────

@router.post("/{user_id}/reset-restrictions", status_code=200)
def reset_restrictions(user_id: int, db: Session = Depends(get_db)):
    user = _load_or_404(db, user_id)
    conn_svc.reset_restrictions(db, user)
    return {"detail": "Kısıtlamalar sıfırlandı"}


# ─── İzleme istatistikleri ────────────────────────────────────────────────────

@router.get("/{user_id}/stats")
def get_stats(
    user_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _load_or_404(db, user_id)
    return conn_svc.get_watch_stats(db, user_id, page=page, page_size=page_size, date_from=date_from, date_to=date_to)


# ─── Yardımcı ─────────────────────────────────────────────────────────────────

def _load_or_404(db: Session, user_id: int) -> IptvUser:
    user = db.query(IptvUser).filter(IptvUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")
    return user