from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.content import service
from app.modules.content.schemas import (
    BouquetCategoriesBulkUpdate,
    BouquetCategoryCreate,
    BouquetCategoryResponse,
    BouquetCreate,
    BouquetDetailResponse,
    BouquetItemBulkCreate,
    BouquetItemResponse,
    BouquetResponse,
    BouquetUpdate,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    EpisodeCreate,
    EpisodeResponse,
    EpisodeUpdate,
    MovieContentCreate,
    MovieContentResponse,
    MovieContentUpdate,
    MusicDownloadRequest,
    MusicDownloadResponse,
    MusicDownloadStatusResponse,
    MusicPlaylistCreate,
    MusicPlaylistItemCreate,
    MusicPlaylistItemOut,
    MusicPlaylistOut,
    MusicPlaylistUpdate,
    MusicTrackCreate,
    MusicTrackOut,
    MusicTrackUpdate,
    MusicUploadResponse,
    PlaylistReorderRequest,
    RadioContentCreate,
    RadioContentResponse,
    RadioContentUpdate,
    SeasonCreate,
    SeasonResponse,
    SeriesContentCreate,
    SeriesContentResponse,
    SeriesContentUpdate,
    StreamContentCreate,
    StreamContentResponse,
    StreamContentUpdate,
    VisualUploadResponse,
)


router = APIRouter(dependencies=[Depends(get_current_user_id)])


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories/{category_type}", response_model=list[CategoryResponse], tags=["categories"])
def list_categories(category_type: str, db: Session = Depends(get_db)):
    return service.list_categories(db, category_type)


@router.post("/categories/{category_type}", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, tags=["categories"])
def create_category(category_type: str, payload: CategoryCreate, db: Session = Depends(get_db)):
    return service.create_category(db, category_type, payload)


@router.put("/categories/{category_type}/{category_id}", response_model=CategoryResponse, tags=["categories"])
def update_category(category_type: str, category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    return service.update_category(db, category_type, category_id, payload)


@router.delete("/categories/{category_type}/{category_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["categories"])
def delete_category(category_type: str, category_id: int, db: Session = Depends(get_db)):
    service.delete_category(db, category_type, category_id)


# ── Bouquets ──────────────────────────────────────────────────────────────────

@router.get("/bouquets", response_model=list[BouquetResponse], tags=["bouquets"])
def list_bouquets(db: Session = Depends(get_db)):
    return service.list_bouquets(db)


@router.post("/bouquets", response_model=BouquetResponse, status_code=status.HTTP_201_CREATED, tags=["bouquets"])
def create_bouquet(payload: BouquetCreate, db: Session = Depends(get_db)):
    return service.create_bouquet(db, payload)


@router.get("/bouquets/{bouquet_id}", response_model=BouquetDetailResponse, tags=["bouquets"])
def get_bouquet(bouquet_id: int, db: Session = Depends(get_db)):
    return service.get_bouquet(db, bouquet_id)


@router.put("/bouquets/{bouquet_id}", response_model=BouquetDetailResponse, tags=["bouquets"])
def update_bouquet(bouquet_id: int, payload: BouquetUpdate, db: Session = Depends(get_db)):
    return service.update_bouquet(db, bouquet_id, payload)


@router.delete("/bouquets/{bouquet_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["bouquets"])
def delete_bouquet(bouquet_id: int, db: Session = Depends(get_db)):
    service.delete_bouquet(db, bouquet_id)


@router.post("/bouquets/{bouquet_id}/categories", response_model=BouquetCategoryResponse, status_code=status.HTTP_201_CREATED, tags=["bouquets"])
def add_bouquet_category(bouquet_id: int, payload: BouquetCategoryCreate, db: Session = Depends(get_db)):
    return service.add_bouquet_category(db, bouquet_id, payload)


@router.delete("/bouquets/{bouquet_id}/categories/{category_type}/{category_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["bouquets"])
def remove_bouquet_category(bouquet_id: int, category_type: str, category_id: int, db: Session = Depends(get_db)):
    service.remove_bouquet_category(db, bouquet_id, category_type, category_id)


@router.put("/bouquets/{bouquet_id}/categories", response_model=BouquetDetailResponse, tags=["bouquets"])
def replace_bouquet_categories(bouquet_id: int, payload: BouquetCategoriesBulkUpdate, db: Session = Depends(get_db)):
    return service.replace_bouquet_categories(db, bouquet_id, payload)


@router.get("/bouquets/{bouquet_id}/items", response_model=list[BouquetItemResponse], tags=["bouquets"])
def list_bouquet_items(bouquet_id: int, db: Session = Depends(get_db)):
    return service.list_bouquet_items(db, bouquet_id)


@router.post("/bouquets/{bouquet_id}/items", response_model=list[BouquetItemResponse], status_code=status.HTTP_201_CREATED, tags=["bouquets"])
def add_bouquet_items(bouquet_id: int, payload: BouquetItemBulkCreate, db: Session = Depends(get_db)):
    return service.add_bouquet_items(db, bouquet_id, payload)


@router.delete("/bouquets/{bouquet_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["bouquets"])
def remove_bouquet_item(bouquet_id: int, item_id: int, db: Session = Depends(get_db)):
    service.remove_bouquet_item(db, bouquet_id, item_id)


# ── Movies Content ────────────────────────────────────────────────────────────

@router.get("/movies", response_model=list[MovieContentResponse], tags=["movies"])
def list_movies(category_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_movie_contents(db, category_id)


@router.post("/movies", response_model=MovieContentResponse, status_code=status.HTTP_201_CREATED, tags=["movies"])
def create_movie(payload: MovieContentCreate, db: Session = Depends(get_db)):
    return service.create_movie_content(db, payload)


@router.put("/movies/{movie_id}", response_model=MovieContentResponse, tags=["movies"])
def update_movie(movie_id: int, payload: MovieContentUpdate, db: Session = Depends(get_db)):
    return service.update_movie_content(db, movie_id, payload)


@router.delete("/movies/{movie_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["movies"])
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    service.delete_movie_content(db, movie_id)


# ── Series Content ────────────────────────────────────────────────────────────

BROADCAST_DAY_MAP = {
    0: "Pazartesi",
    1: "Sali",
    2: "Carsamba",
    3: "Persembe",
    4: "Cuma",
    5: "Cumartesi",
    6: "Pazar",
}


@router.get("/series/broadcast/today", response_model=list[SeriesContentResponse], tags=["series"])
def series_broadcast_today(db: Session = Depends(get_db)):
    today_name = BROADCAST_DAY_MAP[datetime.now(timezone.utc).weekday()]
    return service.list_series_by_broadcast_day(db, today_name)


@router.get("/series", response_model=list[SeriesContentResponse], tags=["series"])
def list_series(category_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_series(db, category_id)


@router.post("/series", response_model=SeriesContentResponse, status_code=status.HTTP_201_CREATED, tags=["series"])
def create_series(payload: SeriesContentCreate, db: Session = Depends(get_db)):
    return service.create_series(db, payload)


@router.put("/series/{series_id}", response_model=SeriesContentResponse, tags=["series"])
def update_series(series_id: int, payload: SeriesContentUpdate, db: Session = Depends(get_db)):
    return service.update_series(db, series_id, payload)


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["series"])
def delete_series(series_id: int, db: Session = Depends(get_db)):
    service.delete_series(db, series_id)


@router.get("/series/{series_id}/seasons", response_model=list[SeasonResponse], tags=["series"])
def list_seasons(series_id: int, db: Session = Depends(get_db)):
    return service.list_seasons(db, series_id)


@router.post("/series/{series_id}/seasons", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED, tags=["series"])
def create_season(series_id: int, payload: SeasonCreate, db: Session = Depends(get_db)):
    return service.create_season(db, series_id, payload)


@router.delete("/series/{series_id}/seasons/{season_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["series"])
def delete_season(series_id: int, season_id: int, db: Session = Depends(get_db)):
    service.delete_season(db, series_id, season_id)


@router.get("/seasons/{season_id}/episodes", response_model=list[EpisodeResponse], tags=["series"])
def list_episodes(season_id: int, db: Session = Depends(get_db)):
    return service.list_episodes(db, season_id)


@router.post("/seasons/{season_id}/episodes", response_model=EpisodeResponse, status_code=status.HTTP_201_CREATED, tags=["series"])
def create_episode(season_id: int, payload: EpisodeCreate, db: Session = Depends(get_db)):
    return service.create_episode(db, season_id, payload)


@router.put("/episodes/{episode_id}", response_model=EpisodeResponse, tags=["series"])
def update_episode(episode_id: int, payload: EpisodeUpdate, db: Session = Depends(get_db)):
    return service.update_episode(db, episode_id, payload)


@router.delete("/episodes/{episode_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["series"])
def delete_episode(episode_id: int, db: Session = Depends(get_db)):
    service.delete_episode(db, episode_id)


@router.get("/episodes/{episode_id}/download", tags=["series"])
def download_episode(episode_id: int, db: Session = Depends(get_db)):
    """Stream / download the video file attached to an episode."""
    ep = service.get_episode_raw(db, episode_id)
    if not ep.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bu bolume ait dosya yolu tanimlanmamis")
    file = Path(ep.file_path)
    if not file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dosya bulunamadi: {ep.file_path}")
    return FileResponse(
        path=str(file),
        filename=file.name,
        media_type="application/octet-stream",
    )


# ── TV Content ────────────────────────────────────────────────────────────────

@router.get("/tv", response_model=list[StreamContentResponse], tags=["tv"])
def list_tv(category_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_tv_contents(db, category_id)


@router.post("/tv", response_model=StreamContentResponse, status_code=status.HTTP_201_CREATED, tags=["tv"])
def create_tv(payload: StreamContentCreate, db: Session = Depends(get_db)):
    return service.create_tv_content(db, payload)


@router.put("/tv/{tv_id}", response_model=StreamContentResponse, tags=["tv"])
def update_tv(tv_id: int, payload: StreamContentUpdate, db: Session = Depends(get_db)):
    return service.update_tv_content(db, tv_id, payload)


@router.delete("/tv/{tv_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tv"])
def delete_tv(tv_id: int, db: Session = Depends(get_db)):
    service.delete_tv_content(db, tv_id)


# ── Radio Content ─────────────────────────────────────────────────────────────

@router.get("/radio", response_model=list[RadioContentResponse], tags=["radio"])
def list_radio(category_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_radio_contents(db, category_id)


@router.post("/radio", response_model=RadioContentResponse, status_code=status.HTTP_201_CREATED, tags=["radio"])
def create_radio(payload: RadioContentCreate, db: Session = Depends(get_db)):
    return service.create_radio_content(db, payload)


@router.put("/radio/{radio_id}", response_model=RadioContentResponse, tags=["radio"])
def update_radio(radio_id: int, payload: RadioContentUpdate, db: Session = Depends(get_db)):
    return service.update_radio_content(db, radio_id, payload)


@router.delete("/radio/{radio_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["radio"])
def delete_radio(radio_id: int, db: Session = Depends(get_db)):
    service.delete_radio_content(db, radio_id)


@router.post("/radio/{radio_id}/start", tags=["radio"])
def start_radio(radio_id: int, db: Session = Depends(get_db)):
    from app.modules.content.radio_broadcast import start_radio_channel
    return start_radio_channel(db, radio_id)


@router.post("/radio/{radio_id}/stop", tags=["radio"])
def stop_radio(radio_id: int, db: Session = Depends(get_db)):
    from app.modules.content.radio_broadcast import stop_radio_channel
    return stop_radio_channel(db, radio_id)


@router.post("/radio/{radio_id}/restart", tags=["radio"])
def restart_radio(radio_id: int, db: Session = Depends(get_db)):
    from app.modules.content.radio_broadcast import restart_radio_channel
    return restart_radio_channel(db, radio_id)


# ── Music Tracks ──────────────────────────────────────────────────────────────

@router.get("/music/tracks", response_model=list[MusicTrackOut], tags=["music"])
def list_music_tracks(category_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_music_tracks(db, category_id)


@router.post("/music/tracks", response_model=MusicTrackOut, status_code=status.HTTP_201_CREATED, tags=["music"])
def create_music_track(payload: MusicTrackCreate, db: Session = Depends(get_db)):
    return service.create_music_track(db, payload)


@router.put("/music/tracks/{track_id}", response_model=MusicTrackOut, tags=["music"])
def update_music_track(track_id: int, payload: MusicTrackUpdate, db: Session = Depends(get_db)):
    return service.update_music_track(db, track_id, payload)


@router.delete("/music/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["music"])
def delete_music_track(track_id: int, db: Session = Depends(get_db)):
    service.delete_music_track(db, track_id)


# ── Music Playlists ───────────────────────────────────────────────────────────

@router.get("/music/playlists", response_model=list[MusicPlaylistOut], tags=["music"])
def list_music_playlists(db: Session = Depends(get_db)):
    return service.list_music_playlists(db)


@router.post("/music/playlists", response_model=MusicPlaylistOut, status_code=status.HTTP_201_CREATED, tags=["music"])
def create_music_playlist(payload: MusicPlaylistCreate, db: Session = Depends(get_db)):
    return service.create_music_playlist(db, payload)


@router.get("/music/playlists/{playlist_id}", response_model=MusicPlaylistOut, tags=["music"])
def get_music_playlist(playlist_id: int, db: Session = Depends(get_db)):
    return service.get_music_playlist(db, playlist_id)


@router.put("/music/playlists/{playlist_id}", response_model=MusicPlaylistOut, tags=["music"])
def update_music_playlist(playlist_id: int, payload: MusicPlaylistUpdate, db: Session = Depends(get_db)):
    return service.update_music_playlist(db, playlist_id, payload)


@router.delete("/music/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["music"])
def delete_music_playlist(playlist_id: int, db: Session = Depends(get_db)):
    service.delete_music_playlist(db, playlist_id)


@router.post("/music/playlists/{playlist_id}/items", response_model=MusicPlaylistItemOut, status_code=status.HTTP_201_CREATED, tags=["music"])
def add_playlist_item(playlist_id: int, payload: MusicPlaylistItemCreate, db: Session = Depends(get_db)):
    return service.add_playlist_item(db, playlist_id, payload)


@router.delete("/music/playlists/{playlist_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["music"])
def remove_playlist_item(playlist_id: int, item_id: int, db: Session = Depends(get_db)):
    service.remove_playlist_item(db, playlist_id, item_id)


@router.put("/music/playlists/{playlist_id}/items/reorder", response_model=MusicPlaylistOut, tags=["music"])
def reorder_playlist_items(playlist_id: int, payload: PlaylistReorderRequest, db: Session = Depends(get_db)):
    return service.reorder_playlist_items(db, playlist_id, payload.item_ids)


# ── Music Playlist Broadcast ───────────────────────────────────────────────────

@router.post("/music/playlists/{playlist_id}/start", tags=["music"])
def start_music_broadcast(playlist_id: int, db: Session = Depends(get_db)):
    from app.modules.content.music_broadcast import start_music_playlist
    return start_music_playlist(db, playlist_id)


@router.post("/music/playlists/{playlist_id}/stop", tags=["music"])
def stop_music_broadcast(playlist_id: int, db: Session = Depends(get_db)):
    from app.modules.content.music_broadcast import stop_music_playlist
    return stop_music_playlist(db, playlist_id)


@router.get("/music/playlists/{playlist_id}/status", tags=["music"])
def music_broadcast_status(playlist_id: int, db: Session = Depends(get_db)):
    from app.modules.content.music_broadcast import get_music_playlist_status
    return get_music_playlist_status(db, playlist_id)


# ── Music YouTube Download ─────────────────────────────────────────────────────

ALLOWED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}
ALLOWED_VISUAL_EXTENSIONS = {".mp4", ".webm", ".jpg", ".jpeg", ".png", ".gif"}
MUSIC_UPLOADS_ROOT = Path("/var/www/vod-manager/shared/uploads/music")
VISUAL_UPLOADS_ROOT = Path("/var/www/vod-manager/shared/uploads/visuals")


@router.post("/music/download-youtube", response_model=MusicDownloadResponse, status_code=status.HTTP_202_ACCEPTED, tags=["music"])
def music_download_youtube(payload: MusicDownloadRequest):
    """YouTube URL'sinden MP3 indir (async Celery task)."""
    from app.modules.content.tasks import download_music_youtube

    task = download_music_youtube.delay(
        url=payload.url,
        title=payload.title,
        artist=payload.artist,
        category_id=payload.category_id,
        vpn_client_id=payload.vpn_client_id,
    )
    return MusicDownloadResponse(task_id=task.id, status="queued")


@router.get("/music/download-status/{task_id}", tags=["music"])
def music_download_status(task_id: str):
    """Celery task durumunu sorgula. Frontend-uyumlu format dondurur."""
    from app.core.celery_app import celery_app
    from celery.result import AsyncResult

    result = AsyncResult(task_id, app=celery_app)
    state = result.state  # PENDING, STARTED, SUCCESS, FAILURE, RETRY

    # Celery durumunu frontend'in bekledigine donustur
    if state == "SUCCESS":
        task_result = result.result if isinstance(result.result, dict) else {}
        if task_result.get("status") == "failed":
            return {
                "task_id": task_id,
                "status": "error",
                "progress": 0,
                "title": None,
                "error": task_result.get("error", "Indirme basarisiz oldu"),
                "track_id": None,
            }
        return {
            "task_id": task_id,
            "status": "done",
            "progress": 100,
            "title": task_result.get("title"),
            "error": None,
            "track_id": task_result.get("track_id"),
        }
    elif state == "FAILURE":
        try:
            err = str(result.result)
        except Exception:
            err = "Bilinmeyen hata"
        return {
            "task_id": task_id,
            "status": "error",
            "progress": 0,
            "title": None,
            "error": err,
            "track_id": None,
        }
    elif state in ("STARTED", "RETRY"):
        return {
            "task_id": task_id,
            "status": "downloading",
            "progress": 50,
            "title": None,
            "error": None,
            "track_id": None,
        }
    else:  # PENDING
        return {
            "task_id": task_id,
            "status": "pending",
            "progress": 0,
            "title": None,
            "error": None,
            "track_id": None,
        }


# ── Music File Upload ──────────────────────────────────────────────────────────

@router.post("/music/upload-file", response_model=MusicUploadResponse, status_code=status.HTTP_201_CREATED, tags=["music"])
async def upload_music_file(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    artist: str | None = Form(default=None),
    category_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """Muzik dosyasi yukle (mp3, wav, flac, ogg, m4a)."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dosya adi bos olamaz")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_MUSIC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya formati: {ext}. Izin verilenler: {', '.join(ALLOWED_MUSIC_EXTENSIONS)}",
        )

    MUSIC_UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    dest_path = MUSIC_UPLOADS_ROOT / file.filename
    # Ayni isimde dosya varsa -1, -2 ekle
    counter = 1
    while dest_path.exists():
        dest_path = MUSIC_UPLOADS_ROOT / f"{Path(file.filename).stem}_{counter}{ext}"
        counter += 1

    content = await file.read()
    dest_path.write_bytes(content)

    track_out = None
    if title:
        track = service.create_music_track(
            db,
            MusicTrackCreate(
                title=title,
                artist=artist,
                file_path=str(dest_path),
                category_id=category_id,
            ),
        )
        track_out = MusicTrackOut.model_validate(track)

    return MusicUploadResponse(
        filename=dest_path.name,
        file_path=str(dest_path),
        track=track_out,
    )


# ── Visual File Upload ─────────────────────────────────────────────────────────

@router.post("/upload-visual", response_model=VisualUploadResponse, status_code=status.HTTP_201_CREATED, tags=["visuals"])
async def upload_visual_file(
    file: UploadFile = File(...),
):
    """Video veya resim yukle (mp4, webm, jpg, jpeg, png, gif). /uploads/visuals/filename URL dondurur."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dosya adi bos olamaz")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VISUAL_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya formati: {ext}. Izin verilenler: {', '.join(ALLOWED_VISUAL_EXTENSIONS)}",
        )

    VISUAL_UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    dest_path = VISUAL_UPLOADS_ROOT / file.filename
    # Ayni isimde dosya varsa -1, -2 ekle
    counter = 1
    while dest_path.exists():
        dest_path = VISUAL_UPLOADS_ROOT / f"{Path(file.filename).stem}_{counter}{ext}"
        counter += 1

    content = await file.read()
    dest_path.write_bytes(content)

    url = f"/uploads/visuals/{dest_path.name}"
    return VisualUploadResponse(filename=dest_path.name, url=url)
