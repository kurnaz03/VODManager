from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.playlist import service
from app.modules.playlist import broadcast
from app.modules.playlist.schemas import PlaylistCreate, PlaylistItemAdd, PlaylistItemReorder, PlaylistUpdate

router = APIRouter(
    prefix="/playlists",
    tags=["playlists"],
    dependencies=[Depends(get_current_user_id)],
)


@router.get("")
def list_playlists(db: Session = Depends(get_db)):
    return service.list_playlists(db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db)):
    return service.create_playlist(db, payload)


@router.get("/jobs/by-profile/{profile_id}")
def list_jobs_by_profile(profile_id: int, db: Session = Depends(get_db)):
    return service.list_completed_jobs_for_profile(db, profile_id)


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


@router.get("/{playlist_id}/epg")
def get_epg(playlist_id: int, db: Session = Depends(get_db)):
    xml_content = broadcast.generate_epg_xml(db, playlist_id)
    return Response(content=xml_content, media_type="application/xml")


@router.get("/{playlist_id}/epg.xml")
def download_epg(playlist_id: int, db: Session = Depends(get_db)):
    xml_content = broadcast.generate_epg_xml(db, playlist_id)
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=epg_playlist_{playlist_id}.xml"},
    )
