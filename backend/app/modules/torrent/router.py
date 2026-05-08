from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.torrent import service
from app.modules.torrent.schemas import TorrentAddRequest, TorrentResponse, TorrentFileItem

router = APIRouter(prefix="/torrent", dependencies=[Depends(get_current_user_id)])


@router.post("", response_model=TorrentResponse, status_code=status.HTTP_201_CREATED, tags=["torrent"])
def add_torrent(payload: TorrentAddRequest, db: Session = Depends(get_db)):
    return service.add_torrent(db, payload)


@router.get("", response_model=list[TorrentResponse], tags=["torrent"])
def list_torrents(db: Session = Depends(get_db)):
    return service.list_torrents(db)


@router.put("/{torrent_id}/pause", response_model=TorrentResponse, tags=["torrent"])
def pause_torrent(torrent_id: int, db: Session = Depends(get_db)):
    return service.pause_torrent(db, torrent_id)


@router.put("/{torrent_id}/resume", response_model=TorrentResponse, tags=["torrent"])
def resume_torrent(torrent_id: int, db: Session = Depends(get_db)):
    return service.resume_torrent(db, torrent_id)


@router.delete("/{torrent_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["torrent"])
def delete_torrent(
    torrent_id: int,
    remove_files: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    service.delete_torrent(db, torrent_id, remove_files=remove_files)


@router.get("/{torrent_id}/files", response_model=list[TorrentFileItem], tags=["torrent"])
def get_torrent_files(torrent_id: int):
    return service.get_torrent_files(torrent_id)
