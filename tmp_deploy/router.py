from fastapi import APIRouter, Depends, status, UploadFile, File, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pathlib import Path
import uuid

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.playlist import service
from app.modules.playlist import broadcast
from app.modules.playlist import info_screen_broadcast
from app.modules.playlist.schemas import (
    PlaylistCreate, PlaylistItemAdd, PlaylistItemReorder, PlaylistUpdate,
    InfoScreenTemplateCreate, InfoScreenTemplateUpdate, InfoScreenTemplateResponse,
)
from app.modules.playlist.models import InfoScreenTemplate

router = APIRouter(
    prefix="/playlists",
    tags=["playlists"],
    dependencies=[Depends(get_current_user_id)],
)

# Auth-free router for EPG endpoints (IPTV devices need direct access)
epg_router = APIRouter(
    prefix="/playlists",
    tags=["playlists"],
)

UPLOADS_DIR = Path("/var/www/vod-manager/shared/uploads")
BG_DIR = UPLOADS_DIR / "info-screen-bg"


def _ensure_bouquet_item(db: Session, bouquet_id: int, template_id: int) -> None:
    """Bouquet'e info_screen item ekler, zaten varsa ekleme."""
    from app.modules.content.models import BouquetItem, BouquetItemType
    existing = (
        db.query(BouquetItem)
        .filter(
            BouquetItem.bouquet_id == bouquet_id,
            BouquetItem.item_type == BouquetItemType.info_screen,
            BouquetItem.item_id == template_id,
        )
        .first()
    )
    if existing:
        return
    # Mevcut max position bul
    from sqlalchemy import func as sqlfunc
    max_pos = db.query(sqlfunc.max(BouquetItem.position)).filter(
        BouquetItem.bouquet_id == bouquet_id
    ).scalar() or 0
    item = BouquetItem(
        bouquet_id=bouquet_id,
        item_type=BouquetItemType.info_screen,
        item_id=template_id,
        position=max_pos + 1,
    )
    db.add(item)
    db.flush()


@router.get("")
def list_playlists(db: Session = Depends(get_db)):
    return service.list_playlists(db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db)):
    return service.create_playlist(db, payload)


@router.get("/jobs/by-profile/{profile_id}")
def list_jobs_by_profile(profile_id: int, db: Session = Depends(get_db)):
    return service.list_completed_jobs_for_profile(db, profile_id)


# ── Now Playing (static route – must come BEFORE /{playlist_id}) ──────────────

@router.get("/now-playing")
def get_all_now_playing(db: Session = Depends(get_db)):
    return broadcast.get_all_now_playing(db)


# ── Info Screen Templates (static routes – must come BEFORE /{playlist_id}) ───

@router.get("/info-screen/templates", response_model=list[InfoScreenTemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    return db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.desc()).all()


@router.post("/info-screen/templates", status_code=status.HTTP_201_CREATED, response_model=InfoScreenTemplateResponse)
def create_template(payload: InfoScreenTemplateCreate, db: Session = Depends(get_db)):
    if payload.is_default:
        db.query(InfoScreenTemplate).update({InfoScreenTemplate.is_default: False})
    tmpl = InfoScreenTemplate(**payload.model_dump())
    db.add(tmpl)
    db.flush()
    db.refresh(tmpl)

    # Bouquet'e otomatik ekle
    if tmpl.bouquet_id:
        try:
            _ensure_bouquet_item(db, tmpl.bouquet_id, tmpl.id)
        except Exception:
            pass

    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.put("/info-screen/templates/{template_id}", response_model=InfoScreenTemplateResponse)
def update_template(template_id: int, payload: InfoScreenTemplateUpdate, db: Session = Depends(get_db)):
    tmpl = db.query(InfoScreenTemplate).filter(InfoScreenTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template bulunamadi")
    if payload.is_default:
        db.query(InfoScreenTemplate).update({InfoScreenTemplate.is_default: False})

    old_bouquet_id = tmpl.bouquet_id
    for key, value in payload.model_dump().items():
        setattr(tmpl, key, value)
    db.flush()

    # Bouquet değiştiyse ya da yeni bouquet set edildiyse ekle
    if tmpl.bouquet_id and tmpl.bouquet_id != old_bouquet_id:
        try:
            _ensure_bouquet_item(db, tmpl.bouquet_id, tmpl.id)
        except Exception:
            pass
    elif tmpl.bouquet_id and old_bouquet_id == tmpl.bouquet_id:
        # Aynı bouquet, yine de kontrol et (ilk kez eklenmiş olabilir)
        try:
            _ensure_bouquet_item(db, tmpl.bouquet_id, tmpl.id)
        except Exception:
            pass

    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.delete("/info-screen/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    tmpl = db.query(InfoScreenTemplate).filter(InfoScreenTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template bulunamadi")
    db.delete(tmpl)
    db.commit()


@router.post("/info-screen/templates/{template_id}/set-default")
def set_default_template(template_id: int, db: Session = Depends(get_db)):
    tmpl = db.query(InfoScreenTemplate).filter(InfoScreenTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template bulunamadi")
    db.query(InfoScreenTemplate).update({InfoScreenTemplate.is_default: False})
    tmpl.is_default = True
    db.commit()
    return {"ok": True}


@router.post("/info-screen/upload-bg")
def upload_background(file: UploadFile = File(...)):
    BG_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "bg.jpg").suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = BG_DIR / filename
    with dest.open("wb") as f:
        f.write(file.file.read())
    return {"url": f"/uploads/info-screen-bg/{filename}"}


# ── Info Screen Stream Control (static routes – must come BEFORE /{playlist_id}) ──

@router.post("/info-screen/stream/start")
def start_info_screen_stream(db: Session = Depends(get_db)):
    # Aktif (default) template'ın server_id'sini kontrol et
    tmpl = (
        db.query(InfoScreenTemplate)
        .filter(InfoScreenTemplate.is_default == True)
        .first()
    )
    if tmpl is None:
        tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()

    server_id = tmpl.server_id if tmpl else None
    return info_screen_broadcast.start_info_screen_stream(db, server_id=server_id)


@router.post("/info-screen/stream/stop")
def stop_info_screen_stream():
    return info_screen_broadcast.stop_info_screen_stream()


@router.get("/info-screen/stream/status")
def get_info_screen_stream_status():
    return info_screen_broadcast.get_info_screen_stream_status()


# ── Dynamic playlist routes ───────────────────────────────────────────────────

@router.get("/{playlist_id}")
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    return service.get_playlist(db, playlist_id)


@router.put("/{playlist_id}")
def update_playlist(playlist_id: int, payload: PlaylistUpdate, db: Session = Depends(get_db)):
    return service.update_playlist(db, playlist_id, payload)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    service.delete_playlist(db, playlist_id)


@router.post("/{playlist_id}/items", status_code=status.HTTP_201_CREATED)
def add_item(playlist_id: int, payload: PlaylistItemAdd, db: Session = Depends(get_db)):
    return service.add_item(db, playlist_id, payload)


@router.delete("/{playlist_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(playlist_id: int, item_id: int, db: Session = Depends(get_db)):
    service.remove_item(db, playlist_id, item_id)


@router.put("/{playlist_id}/items/reorder")
def reorder_items(playlist_id: int, payload: PlaylistItemReorder, db: Session = Depends(get_db)):
    return service.reorder_items(db, playlist_id, payload)


# ── Broadcast Control ─────────────────────────────────────────────────────────

@router.post("/{playlist_id}/start")
def start_broadcast(playlist_id: int, db: Session = Depends(get_db)):
    return broadcast.start_broadcast(db, playlist_id)


@router.post("/{playlist_id}/stop")
def stop_broadcast(playlist_id: int, db: Session = Depends(get_db)):
    return broadcast.stop_broadcast(db, playlist_id)


@router.get("/{playlist_id}/status")
def get_broadcast_status(playlist_id: int, db: Session = Depends(get_db)):
    return broadcast.get_broadcast_status(db, playlist_id)


@router.post("/{playlist_id}/update-list")
def update_broadcast_list(playlist_id: int, db: Session = Depends(get_db)):
    return broadcast.update_broadcast_list(db, playlist_id)


# ── EPG ───────────────────────────────────────────────────────────────────────

@router.get("/{playlist_id}/epg/programs")
def get_epg_programs(playlist_id: int, db: Session = Depends(get_db)):
    return broadcast.generate_epg_programs(db, playlist_id)


@epg_router.get("/epg")
def get_combined_epg(db: Session = Depends(get_db)):
    xml_content = broadcast.generate_combined_epg_xml(db)
    return Response(content=xml_content, media_type="application/xml")


@epg_router.get("/epg.xml")
def download_combined_epg(db: Session = Depends(get_db)):
    xml_content = broadcast.generate_combined_epg_xml(db)
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": "attachment; filename=epg_all_channels.xml"},
    )


@epg_router.get("/{playlist_id}/epg")
def get_epg(playlist_id: int, db: Session = Depends(get_db)):
    xml_content = broadcast.generate_epg_xml(db, playlist_id)
    return Response(content=xml_content, media_type="application/xml")


@epg_router.get("/{playlist_id}/epg.xml")
def download_epg(playlist_id: int, db: Session = Depends(get_db)):
    xml_content = broadcast.generate_epg_xml(db, playlist_id)
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=epg_playlist_{playlist_id}.xml"},
    )
