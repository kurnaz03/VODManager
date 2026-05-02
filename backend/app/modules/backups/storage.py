import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings


def backup_dir() -> Path:
    path = settings.backup_dir_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def uploads_dir() -> Path:
    return settings.uploads_dir_path


def make_filename(ts: datetime | None = None) -> str:
    if ts is None:
        ts = datetime.now(timezone.utc)
    return f"backup-{ts.strftime('%Y%m%d-%H%M%S')}.tar.gz"


def backup_path(filename: str) -> Path:
    return backup_dir() / filename


def staging_dir(filename: str) -> Path:
    """Same FS as backup_dir so os.rename() is atomic."""
    base = filename.removesuffix(".tar.gz")
    return backup_dir() / f".staging-{base}"


def check_disk_space() -> None:
    free_bytes = shutil.disk_usage(str(backup_dir())).free
    free_gb = free_bytes / (1024 ** 3)
    if free_gb < settings.BACKUP_MIN_DISK_FREE_GB:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=(
                f"Yetersiz disk alani: {free_gb:.2f} GB mevcut, "
                f"{settings.BACKUP_MIN_DISK_FREE_GB} GB gerekli."
            ),
        )


def get_free_gb() -> float:
    return shutil.disk_usage(str(backup_dir())).free / (1024 ** 3)
