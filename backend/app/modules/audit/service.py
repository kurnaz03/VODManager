import json
from sqlalchemy.orm import Session
from app.modules.users.models import ActivityLog


def log_event(
    db: Session,
    action: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    db.commit()
