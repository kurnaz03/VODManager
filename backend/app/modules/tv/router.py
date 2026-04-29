from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.tv import service
from app.modules.tv.schemas import (
    TvChannelBouquetCreate,
    TvChannelCreate,
    TvChannelOut,
    TvChannelServerCreate,
    TvChannelTestResult,
    TvChannelUpdate,
)

router = APIRouter(prefix="/tv/channels", tags=["tv"], dependencies=[Depends(get_current_user_id)])


@router.get("", response_model=List[TvChannelOut])
def list_channels(
    category_id: Optional[int] = Query(None),
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    return service.list_channels(db, category_id=category_id, active_only=active_only)


@router.post("", response_model=TvChannelOut, status_code=201)
def create_channel(
    payload: TvChannelCreate,
    db: Session = Depends(get_db),
):
    return service.create_channel(db, payload)


@router.get("/{channel_id}", response_model=TvChannelOut)
def get_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    return service.get_channel(db, channel_id)


@router.put("/{channel_id}", response_model=TvChannelOut)
def update_channel(
    channel_id: int,
    payload: TvChannelUpdate,
    db: Session = Depends(get_db),
):
    return service.update_channel(db, channel_id, payload)


@router.delete("/{channel_id}", status_code=204)
def delete_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    service.delete_channel(db, channel_id)


@router.get("/{channel_id}/test", response_model=TvChannelTestResult)
async def test_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    return await service.test_channel_stream(db, channel_id)


@router.post("/{channel_id}/start", response_model=TvChannelOut)
def start_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    return service.start_channel(db, channel_id)


@router.post("/{channel_id}/stop", response_model=TvChannelOut)
def stop_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    return service.stop_channel(db, channel_id)


@router.post("/{channel_id}/restart", response_model=TvChannelOut)
def restart_channel(
    channel_id: int,
    db: Session = Depends(get_db),
):
    return service.restart_channel(db, channel_id)
