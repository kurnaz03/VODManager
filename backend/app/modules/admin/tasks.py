import logging
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.modules.admin.tasks.auto_update_check")
def auto_update_check() -> dict:
    from app.modules.admin.update_service import check_update, apply_update

    try:
        info = check_update()
        logger.info(
            "Otomatik guncelleme kontrolu: current=%s remote=%s update_available=%s",
            info["current_commit"],
            info["remote_commit"],
            info["update_available"],
        )

        if info["update_available"]:
            logger.info("Guncelleme mevcut, uygulanıyor...")
            result = apply_update()
            logger.info("Guncelleme tamamlandi: %s", result["message"])
            return result

        return {"update_available": False, "message": "Panel guncel, guncelleme gerekmiyor."}
    except Exception as exc:
        logger.error("Otomatik guncelleme hatasi: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
