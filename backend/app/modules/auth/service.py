from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.modules.auth import repository
from app.modules.auth.schemas import (
    InitialAdminCreate, LoginRequest, TokenResponse, UserMeResponse,
    AdminUserCreate, AdminUserUpdate, ChangePasswordRequest,
    UserProfileUpdate,
)
from app.modules.settings.service import is_initial_admin_created, mark_initial_admin_created
from app.modules.audit.service import log_event


def get_setup_status(db: Session) -> dict:
    admin_created = is_initial_admin_created(db)
    return {
        "initial_admin_created": admin_created,
        "setup_enabled": not admin_created,
    }


def create_initial_admin(
    db: Session,
    data: InitialAdminCreate,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict:
    if is_initial_admin_created(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ilk admin zaten olusturuldu. Setup ekrani kapali.",
        )

    if repository.get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanici adi zaten kullaniliyor",
        )

    if repository.get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email zaten kullaniliyor",
        )

    password_hash = hash_password(data.password)
    user = repository.create_user_with_role(
        db,
        username=data.username,
        email=data.email,
        password_hash=password_hash,
        role_code="super_admin",
    )

    mark_initial_admin_created(db)
    log_event(db, action="initial_admin_created", user_id=user.id, ip_address=ip, user_agent=user_agent)

    return {"message": "Admin basariyla olusturuldu", "username": user.username}


def login(
    db: Session,
    data: LoginRequest,
    ip: str | None = None,
    user_agent: str | None = None,
) -> TokenResponse:
    user = repository.get_user_by_username(db, data.username)
    if user is None:
        user = repository.get_user_by_email(db, data.username)

    if user is None or not verify_password(data.password, user.password_hash):
        log_event(db, action="login_failed", ip_address=ip, user_agent=user_agent,
                  metadata={"attempted_username": data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanici adi veya sifre hatali",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabiniz aktif degil",
        )

    if user.expires_at and user.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabinizin suresi dolmus",
        )

    roles = repository.get_user_roles(db, user)
    token_data = {"sub": str(user.id), "roles": roles}

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token({"sub": str(user.id)})

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    repository.save_refresh_token(db, user.id, refresh_token, expires_at)
    repository.update_last_login(db, user)

    log_event(db, action="login_success", user_id=user.id, ip_address=ip, user_agent=user_agent)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


def refresh(db: Session, refresh_token: str) -> TokenResponse:
    from app.core.security import decode_token
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gecersiz refresh token")

    rt = repository.validate_refresh_token(db, refresh_token)
    if rt is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token gecersiz veya suresi dolmus")

    user_id = int(payload["sub"])
    user = repository.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanici bulunamadi")

    roles = repository.get_user_roles(db, user)
    token_data = {"sub": str(user.id), "roles": roles}

    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token({"sub": str(user.id)})

    repository.revoke_refresh_token(db, refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    repository.save_refresh_token(db, user.id, new_refresh, expires_at)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


def logout(db: Session, refresh_token: str) -> dict:
    repository.revoke_refresh_token(db, refresh_token)
    return {"message": "Cikis yapildi"}


def get_me(db: Session, user_id: int) -> UserMeResponse:
    user = repository.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")
    roles = repository.get_user_roles(db, user)
    return UserMeResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        status=user.status,
        roles=roles,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


# ── Admin user management ─────────────────────────────────────────────────────

def list_admin_users(db: Session) -> list[dict]:
    from app.modules.users.models import User
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        roles = repository.get_user_roles(db, u)
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "status": u.status,
            "roles": roles,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
        })
    return result


def create_admin_user(db: Session, data: AdminUserCreate) -> dict:
    if repository.get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanici adi zaten kullaniliyor",
        )
    if repository.get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email zaten kullaniliyor",
        )

    password_hash = hash_password(data.password)
    user = repository.create_user_with_role(
        db,
        username=data.username,
        email=data.email,
        password_hash=password_hash,
        role_code=data.role,
    )

    if data.status != "active":
        user.status = data.status
        db.commit()
        db.refresh(user)

    roles = repository.get_user_roles(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "status": user.status,
        "roles": roles,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }


def update_admin_user(db: Session, target_id: int, data: AdminUserUpdate) -> dict:
    from app.modules.users.models import User, UserRoleAssignment, Role
    user = repository.get_user_by_id(db, target_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    if data.username is not None:
        new_username = data.username.strip()
        if new_username and new_username != user.username:
            if repository.get_user_by_username(db, new_username):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu kullanici adi zaten kullaniliyor",
                )
            user.username = new_username

    if data.email is not None:
        existing = repository.get_user_by_email(db, data.email)
        if existing and existing.id != target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu email zaten kullaniliyor",
            )
        user.email = data.email

    if data.status is not None:
        user.status = data.status

    if data.role is not None:
        role = repository.get_role_by_code(db, data.role)
        if role is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gecersiz rol")
        db.query(UserRoleAssignment).filter(UserRoleAssignment.user_id == target_id).delete()
        db.add(UserRoleAssignment(user_id=target_id, role_id=role.id))

    db.add(user)
    db.commit()
    db.refresh(user)

    roles = repository.get_user_roles(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "status": user.status,
        "roles": roles,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }


def delete_admin_user(db: Session, target_id: int, current_user_id: int) -> dict:
    if target_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendinizi silemezsiniz",
        )
    from app.modules.users.models import User
    user = repository.get_user_by_id(db, target_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")
    db.delete(user)
    db.commit()
    return {"message": "Kullanici silindi"}


def change_password(db: Session, user_id: int, data: ChangePasswordRequest) -> dict:
    from app.core.security import verify_password, hash_password
    user = repository.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut sifre yanlis",
        )

    user.password_hash = hash_password(data.new_password)
    db.add(user)
    db.commit()
    return {"message": "Sifre basariyla degistirildi"}


def update_profile(db: Session, user_id: int, data: UserProfileUpdate) -> dict:
    from app.modules.users.models import User
    user = repository.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanici bulunamadi")

    if data.username is not None:
        new_username = data.username.strip()
        if new_username and new_username != user.username:
            if repository.get_user_by_username(db, new_username):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu kullanici adi zaten kullaniliyor",
                )
            user.username = new_username

    if data.email is not None:
        existing = repository.get_user_by_email(db, data.email)
        if existing and existing.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu email zaten kullaniliyor",
            )
        user.email = data.email

    db.add(user)
    db.commit()
    db.refresh(user)

    roles = repository.get_user_roles(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "status": user.status,
        "roles": roles,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }

