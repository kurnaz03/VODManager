from celery import Celery
from celery.schedules import crontab
from app.core.config import settings


celery_app = Celery(
    "vod_manager",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "collect-server-metrics-every-minute": {
        "task": "app.modules.servers.tasks.collect_server_metrics",
        "schedule": 60.0,
    },
    "refresh-youtube-cookies-every-four-minutes": {
        "task": "app.modules.settings.tasks.refresh_youtube_cookies",
        "schedule": 240.0,
    },
    "process-download-queue-every-fifteen-seconds": {
        "task": "app.modules.downloads.tasks.process_download_queue",
        "schedule": 15.0,
    },
    "auto-update-check-daily": {
        "task": "app.modules.admin.tasks.auto_update_check",
        "schedule": crontab(hour=4, minute=0),
    },
    "daily-auto-backup": {
        "task": "app.modules.backups.tasks.scheduled_auto_backup",
        "schedule": crontab(hour=3, minute=0),
    },
    "reset-stuck-transcode-jobs-every-ten-minutes": {
        "task": "app.modules.transcode.tasks.reset_stuck_transcode_jobs",
        "schedule": 600.0,
    },
    "torrent-progress-poll-every-five-seconds": {
        "task": "app.modules.torrent.tasks.poll_torrent_progress",
        "schedule": 5.0,
    },
}
celery_app.autodiscover_tasks(["app.modules.servers", "app.modules.settings", "app.modules.downloads", "app.modules.transcode", "app.modules.admin", "app.modules.content", "app.modules.backups", "app.modules.torrent"])