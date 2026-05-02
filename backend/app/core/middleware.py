import asyncio

import redis as redis_lib
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

_MAINTENANCE_EXEMPT_PREFIXES = (
    "/api/v1/backups",
    "/health",
    "/api/docs",
    "/api/redoc",
    "/uploads",
)

_redis = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    """
    When Redis key 'maintenance_mode' == '1', returns HTTP 503 for all
    non-exempt paths. Fails open if Redis is unavailable.
    Uses asyncio.to_thread to avoid blocking the event loop.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in _MAINTENANCE_EXEMPT_PREFIXES):
            return await call_next(request)

        try:
            value = await asyncio.to_thread(_redis.get, "maintenance_mode")
            is_maintenance = value == "1"
        except Exception:
            is_maintenance = False

        if is_maintenance:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Sistem bakim modunda. Lutfen birkaç dakika icinde tekrar deneyin.",
                    "maintenance_mode": True,
                },
                headers={"Retry-After": "120"},
            )

        return await call_next(request)
