from app.core.celery_app import celery_app
from app.modules.torrent.service import update_torrent_progress_from_celery


@celery_app.task(name="app.modules.torrent.tasks.poll_torrent_progress")
def poll_torrent_progress() -> dict:
    """Celery beat task as secondary progress update mechanism.
    The primary mechanism is the background thread in service.py."""
    update_torrent_progress_from_celery()
    return {"status": "ok"}
