from datetime import datetime, timezone, timedelta

from celery.signals import worker_ready

from app.core.celery_app import celery_app
from app.modules.transcode.job_service import process_transcode, process_preview


@celery_app.task(name="app.modules.transcode.tasks.run_transcode_job")
def run_transcode_job(job_id: int) -> dict:
    process_transcode(job_id)
    return {"job_id": job_id}


@celery_app.task(name="app.modules.transcode.tasks.run_preview_job")
def run_preview_job(job_id: int) -> dict:
    process_preview(job_id)
    return {"job_id": job_id}


@celery_app.task(name="app.modules.transcode.tasks.reset_stuck_transcode_jobs")
def reset_stuck_transcode_jobs() -> dict:
    """Reset transcoding jobs stuck for more than 20 minutes (worker crash / SSH drop)."""
    from app.core.database import SessionLocal
    from app.modules.transcode.models import TranscodeJob

    db = SessionLocal()
    try:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(minutes=20)
        stuck = (
            db.query(TranscodeJob)
            .filter(
                TranscodeJob.status == "transcoding",
                TranscodeJob.started_at < cutoff,
            )
            .all()
        )
        for job in stuck:
            job.status = "failed"
            job.error_message = "Transcode sureci tamamlanamadi (worker yeniden basladi veya baglanti koptu)"
            db.add(job)
        if stuck:
            db.commit()
        return {"reset": len(stuck)}
    finally:
        db.close()


@worker_ready.connect
def _reset_stuck_on_startup(sender, **kwargs):
    """On worker start: reset any jobs stuck in 'transcoding' state (from crashed previous session)."""
    from app.core.database import SessionLocal
    from app.modules.transcode.models import TranscodeJob

    db = SessionLocal()
    try:
        stuck = (
            db.query(TranscodeJob)
            .filter(TranscodeJob.status.in_(["transcoding", "previewing"]))
            .all()
        )
        for job in stuck:
            job.status = "failed"
            job.error_message = "Worker yeniden basladi; onceki transcode/onizleme islemi iptal edildi"
            db.add(job)
        if stuck:
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
