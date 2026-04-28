import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.modules.admin.update_service import check_update, apply_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/update", tags=["admin-update"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _require_auth(token: str = Depends(oauth2_scheme)) -> int:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token gerekli")
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gecersiz token")
    return int(payload["sub"])


@router.get("/check")
def update_check(_user_id: int = Depends(_require_auth)):
    try:
        return check_update()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/apply")
def update_apply(_user_id: int = Depends(_require_auth)):
    try:
        return apply_update()
    except RuntimeError as exc:
        logger.error("Guncelleme uygulanamadi: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
