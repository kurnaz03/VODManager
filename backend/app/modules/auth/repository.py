from sqlalchemy.orm import Session
from datetime import datetime, timezone
from hashlib import sha256
from app.modules.users.models import User, Role, UserRoleAssignment, RefreshToken


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_role_by_code(db: Session, code: str) -> Role | None:
    return db.query(Role).filter(Role.code == code).first()


def count_admins(db: Session) -> int:
    admin_codes = ("super_admin", "admin")
    return (
        db.query(User)
        .join(UserRoleAssignment, UserRoleAssignment.user_id == User.id)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .filter(Role.code.in_(admin_codes))
        .count()
    )


def create_user_with_role(
    db: Session,
    username: str,
    email: str,
    password_hash: str,
    role_code: str,
) -> User:
    user = User(username=username, email=email, password_hash=password_hash, status="active")
    db.add(user)
    db.flush()

    role = get_role_by_code(db, role_code)
    if role is None:
        raise ValueError(f"Role not found: {role_code}")

    assignment = UserRoleAssignment(user_id=user.id, role_id=role.id)
    db.add(assignment)
    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User) -> None:
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()


def get_user_roles(db: Session, user: User) -> list[str]:
    assignments = (
        db.query(UserRoleAssignment)
        .filter(UserRoleAssignment.user_id == user.id)
        .all()
    )
    role_ids = [a.role_id for a in assignments]
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
    return [r.code for r in roles]


def save_refresh_token(db: Session, user_id: int, token: str, expires_at: datetime) -> None:
    token_hash = sha256(token.encode()).hexdigest()
    rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    db.add(rt)
    db.commit()


def revoke_refresh_token(db: Session, token: str) -> bool:
    token_hash = sha256(token.encode()).hexdigest()
    rt = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.is_revoked == False)
        .first()
    )
    if rt is None:
        return False
    rt.is_revoked = True
    db.commit()
    return True


def validate_refresh_token(db: Session, token: str) -> RefreshToken | None:
    token_hash = sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    rt = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > now,
        )
        .first()
    )
    return rt
