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
