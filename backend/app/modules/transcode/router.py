import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.transcode import service
from app.modules.transcode import job_service
from app.modules.transcode.schemas import (
    TranscodeProfileCreate,
    TranscodeProfileResponse,
    TranscodeProfileUpdate,
)
from app.modules.transcode.job_schemas import (
    TranscodeJobCreate,
    TranscodeJobResponse,
    TranscodeJobUpdate,
)

router = APIRouter(
    prefix="/transcode-profiles",
    tags=["transcode-profiles"],
    dependencies=[Depends(get_current_user_id)],
)

job_router = APIRouter(
    prefix="/transcode-jobs",
    tags=["transcode-jobs"],
    dependencies=[Depends(get_current_user_id)],
)

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB

PREVIEW_DIR = Path("/tmp")


# ── Transcode Profiles ────────────────────────────────────────────────────────

@router.post("/default-vod", response_model=TranscodeProfileResponse, status_code=status.HTTP_201_CREATED)
def create_default_vod_profile(db: Session = Depends(get_db)):
    """Create the recommended VOD channel transcode profile (HLS-ready)."""
    result = service.ensure_default_vod_profile(db)
    if result is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Varsayilan profil zaten mevcut")
    return result


@router.get("", response_model=list[TranscodeProfileResponse])
def list_profiles(db: Session = Depends(get_db)):
    return service.list_profiles(db)


@router.post("", response_model=TranscodeProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(payload: TranscodeProfileCreate, db: Session = Depends(get_db)):
    return service.create_profile(db, payload)


@router.get("/{profile_id}", response_model=TranscodeProfileResponse)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    return service.get_profile(db, profile_id)


@router.put("/{profile_id}", response_model=TranscodeProfileResponse)
def update_profile(profile_id: int, payload: TranscodeProfileUpdate, db: Session = Depends(get_db)):
    return service.update_profile(db, profile_id, payload)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    service.delete_profile(db, profile_id)


@router.post("/{profile_id}/logo", response_model=TranscodeProfileResponse)
async def upload_logo(
    profile_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    import logging
    logger = logging.getLogger(__name__)
    ct = request.headers.get("content-type", "MISSING")
    logger.warning(f"LOGO DEBUG: content-type={ct}, file.filename={file.filename}, file.content_type={file.content_type}")
    if file.content_type not in ALLOWED_LOGO_TYPES:
        logger.warning(f"LOGO REJECTED: content_type={file.content_type} not in {ALLOWED_LOGO_TYPES}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya formati ({file.content_type}). PNG, JPG, SVG veya WebP yukleyin.",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo boyutu 2MB'yi gecemez.",
        )

    ext_map = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/svg+xml": ".svg",
        "image/webp": ".webp",
    }
    ext = ext_map.get(file.content_type, ".png")
    filename = f"profile_{profile_id}_{uuid.uuid4().hex}{ext}"

    return service.update_logo(db, profile_id, filename, content)


# ── Transcode Jobs ────────────────────────────────────────────────────────────

@job_router.get("", response_model=list[TranscodeJobResponse])
def list_jobs(db: Session = Depends(get_db)):
    return job_service.list_jobs(db)


@job_router.post("", response_model=TranscodeJobResponse, status_code=status.HTTP_201_CREATED)
def create_job(payload: TranscodeJobCreate, db: Session = Depends(get_db)):
    return job_service.create_job(db, payload)


@job_router.get("/progress/{job_id}")
def get_job_progress(job_id: int, db: Session = Depends(get_db)):
    """Lightweight polling endpoint for progress."""
    from app.modules.transcode.models import TranscodeJob
    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job bulunamadi")
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "eta_seconds": job.eta_seconds,
    }


@job_router.get("/{job_id}/logs")
def get_job_logs(job_id: int, db: Session = Depends(get_db)):
    """Return log_output, error_message and status for a given job."""
    from app.modules.transcode.models import TranscodeJob
    job = db.query(TranscodeJob).filter(TranscodeJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job bulunamadi")
    return {
        "log_output": job.log_output,
        "error_message": job.error_message,
        "status": job.status,
    }


@job_router.get("/{job_id}", response_model=TranscodeJobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    return job_service.get_job(db, job_id)


@job_router.put("/{job_id}", response_model=TranscodeJobResponse)
def update_job(job_id: int, payload: TranscodeJobUpdate, db: Session = Depends(get_db)):
    return job_service.update_job(db, job_id, payload)


@job_router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job_service.delete_job(db, job_id)


@job_router.post("/{job_id}/start")
def start_job(job_id: int, db: Session = Depends(get_db)):
    return job_service.start_job(db, job_id)


@job_router.post("/{job_id}/stop")
def stop_job(job_id: int, db: Session = Depends(get_db)):
    return job_service.stop_job(db, job_id)


@job_router.post("/{job_id}/preview")
def preview_job(job_id: int, db: Session = Depends(get_db)):
    return job_service.create_preview(db, job_id)


@job_router.get("/{job_id}/preview-file")
def get_preview_file(job_id: int):
    preview_path = PREVIEW_DIR / f"preview_{job_id}.mp4"
    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="Onizleme dosyasi bulunamadi. Once onizleme olusturun.")
    return FileResponse(
        str(preview_path),
        media_type="video/mp4",
        filename=f"preview_{job_id}.mp4",
    )


@job_router.post("/start-queue")
def start_queue(db: Session = Depends(get_db)):
    return job_service.start_queue(db)


@job_router.post("/clear")
def clear_jobs(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    if status_filter:
        count = job_service.clear_by_status(db, status_filter)
    else:
        count = job_service.clear_finished_jobs(db)
    return {"cleared": count}


class ClearSelectedBody(BaseModel):
    ids: list[int]


@job_router.post("/clear-selected")
def clear_selected_jobs(body: ClearSelectedBody, db: Session = Depends(get_db)):
    count = job_service.clear_selected(db, body.ids)
    return {"cleared": count}
