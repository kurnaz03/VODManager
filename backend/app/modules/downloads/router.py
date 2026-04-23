from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.downloads import service
from app.modules.downloads.schemas import (
    DownloadCreate,
    DownloadResponse,
    DownloadSettingsResponse,
    DownloadSettingsUpdate,
    DownloadUpdate,
    TmdbMovieDetailResponse,
    TmdbMovieSearchItem,
    TmdbTvDetailResponse,
    TmdbTvSearchItem,
)


router = APIRouter(dependencies=[Depends(get_current_user_id)])


@router.post("/downloads", response_model=DownloadResponse, status_code=status.HTTP_201_CREATED, tags=["downloads"])
def create_download(
    payload: DownloadCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.create_download(db, payload, user_id)


@router.get("/downloads", response_model=list[DownloadResponse], tags=["downloads"])
def list_downloads(
    status_filter: str | None = Query(default=None, alias="status"),
    category_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return service.list_downloads(db, status_filter=status_filter, category_id=category_id)


@router.get("/downloads/settings", response_model=DownloadSettingsResponse, tags=["downloads"])
def get_download_settings(db: Session = Depends(get_db)):
    return service.get_download_settings(db)


@router.put("/downloads/settings", response_model=DownloadSettingsResponse, tags=["downloads"])
def update_download_settings(payload: DownloadSettingsUpdate, db: Session = Depends(get_db)):
    return service.update_download_settings(db, payload)


@router.post("/downloads/clear", tags=["downloads"])
def clear_downloads(db: Session = Depends(get_db)):
    return service.clear_downloads(db)


@router.get("/downloads/{download_id}", response_model=DownloadResponse, tags=["downloads"])
def get_download(download_id: int, db: Session = Depends(get_db)):
    return service.get_download_detail(db, download_id)


@router.put("/downloads/{download_id}", response_model=DownloadResponse, tags=["downloads"])
def update_download(download_id: int, payload: DownloadUpdate, db: Session = Depends(get_db)):
    return service.update_download(db, download_id, payload)


@router.delete("/downloads/{download_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["downloads"])
def delete_download(download_id: int, db: Session = Depends(get_db)):
    service.delete_download(db, download_id)


@router.post("/downloads/{download_id}/approve", response_model=DownloadResponse, tags=["downloads"])
def approve_download(download_id: int, db: Session = Depends(get_db)):
    return service.approve_download(db, download_id)


@router.post("/downloads/{download_id}/cancel", response_model=DownloadResponse, tags=["downloads"])
def cancel_download(download_id: int, db: Session = Depends(get_db)):
    return service.cancel_download(db, download_id)


@router.post("/downloads/{download_id}/retry", response_model=DownloadResponse, tags=["downloads"])
def retry_download(download_id: int, db: Session = Depends(get_db)):
    return service.retry_download(db, download_id)


@router.get("/tmdb/search/movie", response_model=list[TmdbMovieSearchItem], tags=["tmdb"])
def search_tmdb_movies(query: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    return service.search_tmdb_movies(db, query)


@router.get("/tmdb/movie/{tmdb_id}", response_model=TmdbMovieDetailResponse, tags=["tmdb"])
def get_tmdb_movie_detail(tmdb_id: int, db: Session = Depends(get_db)):
    return service.get_tmdb_movie_detail(db, tmdb_id)


@router.get("/tmdb/search/tv", response_model=list[TmdbTvSearchItem], tags=["tmdb"])
def search_tmdb_tv(query: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    return service.search_tmdb_tv(db, query)


@router.get("/tmdb/tv/{tmdb_id}", response_model=TmdbTvDetailResponse, tags=["tmdb"])
def get_tmdb_tv_detail(tmdb_id: int, db: Session = Depends(get_db)):
    return service.get_tmdb_tv_detail(db, tmdb_id)