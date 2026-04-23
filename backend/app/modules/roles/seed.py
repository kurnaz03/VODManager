from sqlalchemy.orm import Session
from app.modules.users.models import Role

ROLES = [
    {"code": "super_admin", "name": "Super Admin"},
    {"code": "admin", "name": "Admin"},
    {"code": "reseller", "name": "Reseller"},
    {"code": "moderator", "name": "Moderator"},
    {"code": "user", "name": "User"},
]


def seed_roles(db: Session) -> None:
    for role_data in ROLES:
        existing = db.query(Role).filter(Role.code == role_data["code"]).first()
        if not existing:
            role = Role(**role_data)
            db.add(role)
    db.commit()
