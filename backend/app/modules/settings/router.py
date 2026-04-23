from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.settings import service
from app.modules.settings.schemas import (
    ThemeSettingsResponse,
    ThemeSettingsUpdate,
    TmdbSettingsResponse,
    TmdbSettingsUpdate,
    TmdbTestResponse,
    YoutubeLoginRequest,
    YoutubeManualCookiesRequest,
    YoutubeSettingsResponse,
)


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/theme", response_model=ThemeSettingsResponse)
def get_theme_settings(db: Session = Depends(get_db)):
    return service.get_theme_settings(db)


@router.put("/theme", response_model=ThemeSettingsResponse)
def update_theme_settings(
    payload: ThemeSettingsUpdate,
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.update_theme_settings(db, payload)


@router.post("/theme/logo", response_model=ThemeSettingsResponse)
def upload_theme_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.upload_theme_logo(db, file)


@router.delete("/theme/logo", response_model=ThemeSettingsResponse)
def delete_theme_logo(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.delete_theme_logo(db)


@router.get("/theme/logo/{filename}")
def get_theme_logo_file(filename: str):
    return FileResponse(service.resolve_logo_file(filename))


@router.get("/tmdb", response_model=TmdbSettingsResponse)
def get_tmdb_settings(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.get_tmdb_settings(db)


@router.put("/tmdb", response_model=TmdbSettingsResponse)
def update_tmdb_settings(
    payload: TmdbSettingsUpdate,
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.update_tmdb_settings(db, payload)


@router.post("/tmdb/test", response_model=TmdbTestResponse)
def test_tmdb_settings(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.test_tmdb_settings(db)


@router.get("/youtube", response_model=YoutubeSettingsResponse)
def get_youtube_settings(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.get_youtube_settings(db)


@router.post("/youtube/login", response_model=YoutubeSettingsResponse)
def login_youtube(
    payload: YoutubeLoginRequest,
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.login_youtube(db, payload)


@router.post("/youtube/refresh", response_model=YoutubeSettingsResponse)
def refresh_youtube(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.refresh_youtube(db)


@router.post("/youtube/cookies/text", response_model=YoutubeSettingsResponse)
def upload_youtube_cookies_text(
    payload: YoutubeManualCookiesRequest,
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.save_youtube_cookies_text(db, payload.cookies_text)


@router.post("/youtube/cookies/file", response_model=YoutubeSettingsResponse)
def upload_youtube_cookies_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.save_youtube_cookies_file(db, file)


@router.delete("/youtube", response_model=YoutubeSettingsResponse)
def delete_youtube(
    db: Session = Depends(get_db),
    _: int = Depends(get_current_user_id),
):
    return service.delete_youtube(db)