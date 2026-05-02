from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.repository import get_user_by_id, get_user_roles
from app.modules.auth.router import get_current_user_id

_ADMIN_ROLES = {"super_admin", "admin"}


def require_admin(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> int:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanici bulunamadi",
        )
    roles = set(get_user_roles(db, user))
    if not roles.intersection(_ADMIN_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu islem icin yonetici yetkisi gereklidir.",
        )
    return user_id
