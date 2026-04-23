from app.core.database import SessionLocal
from app.core.celery_app import celery_app
from app.modules.servers.service import collect_metrics


@celery_app.task(name="app.modules.servers.tasks.collect_server_metrics")
def collect_server_metrics() -> dict[str, int]:
    db = SessionLocal()
    try:
        collected = collect_metrics(db)
        return {"collected": collected}
    finally:
        db.close()