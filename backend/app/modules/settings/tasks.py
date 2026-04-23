from app.core.celery_app import celery_app
from app.modules.settings.service import refresh_due_youtube_cookies


@celery_app.task(name="app.modules.settings.tasks.refresh_youtube_cookies")
def refresh_youtube_cookies() -> dict[str, int]:
    refreshed = refresh_due_youtube_cookies()
    return {"refreshed": refreshed}