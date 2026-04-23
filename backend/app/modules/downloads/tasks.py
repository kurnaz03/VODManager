from app.core.celery_app import celery_app
from app.modules.downloads.service import process_download, queue_approved_downloads


@celery_app.task(name="app.modules.downloads.tasks.run_download_job")
def run_download_job(download_id: int) -> dict[str, int]:
    process_download(download_id)
    return {"download_id": download_id}


@celery_app.task(name="app.modules.downloads.tasks.process_download_queue")
def process_download_queue() -> dict[str, int]:
    queued = queue_approved_downloads()
    return {"queued": queued}