from __future__ import annotations

import gzip
import json
import logging
import os
import re
import shutil
import subprocess
import tarfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Helpers ──────────────────────────────────────────────────────────────────


def _parse_db_url():
    """Parse SYNC_DATABASE_URL → (user, password, host, port, dbname)."""
    m = re.match(
        r"postgresql(?:\+psycopg2)?://([^:]+):([^@]+)@([^:/]+):?(\d*)/(.+)",
        settings.SYNC_DATABASE_URL,
    )
    if not m:
        raise RuntimeError("SYNC_DATABASE_URL parse edilemedi")
    user, password, host, port, dbname = m.groups()
    return user, password, host, port or "5432", dbname


def _pg_dump(output_path: Path) -> None:
    user, password, host, port, dbname = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = password

    pg_proc = subprocess.Popen(
        ["pg_dump", "-U", user, "-h", host, "-p", port, dbname, "--no-password", "-Fp"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    with gzip.open(str(output_path), "wb") as gz:
        shutil.copyfileobj(pg_proc.stdout, gz)

    _, err_bytes = pg_proc.communicate()
    if pg_proc.returncode != 0:
        err = err_bytes.decode(errors="replace")
        raise RuntimeError(f"pg_dump basarisiz: {err[:1000]}")


def _tar_uploads(output_path: Path, source_dir: Path) -> None:
    with tarfile.open(str(output_path), "w:gz") as tar:
        if source_dir.exists():
            tar.add(str(source_dir), arcname="uploads")


def _delete_backup_file(backup) -> None:
    if backup.file_path:
        p = Path(backup.file_path)
        if p.exists():
            p.unlink(missing_ok=True)


# ── Task 1: create_backup_task ───────────────────────────────────────────────


@celery_app.task(
    name="app.modules.backups.tasks.create_backup_task",
    bind=True,
    max_retries=0,
    time_limit=3600,
    soft_time_limit=3300,
)
def create_backup_task(self, backup_id: str) -> dict:
    from app.core.database import SessionLocal
    from app.modules.backups.models import Backup, BackupStatus
    from app.modules.backups.storage import backup_path, staging_dir, uploads_dir, check_disk_space

    db = SessionLocal()
    backup_uuid = uuid.UUID(backup_id)
    staging = None
    record = None

    try:
        record = db.query(Backup).filter(Backup.id == backup_uuid).first()
        if record is None:
            return {"error": "Backup kaydı bulunamadı"}

        record.status = BackupStatus.running
        record.progress_percent = 0
        db.commit()

        check_disk_space()

        staging = staging_dir(record.filename)
        staging.mkdir(parents=True, exist_ok=True)

        # pg_dump → db.sql.gz
        db_dump_path = staging / "db.sql.gz"
        _pg_dump(db_dump_path)
        record.progress_percent = 40
        db.commit()

        # uploads → uploads.tar.gz
        uploads_archive = staging / "uploads.tar.gz"
        _tar_uploads(uploads_archive, uploads_dir())
        record.progress_percent = 80
        db.commit()

        # manifest.json
        manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "app_version": settings.APP_VERSION,
            "db_dump_size_bytes": db_dump_path.stat().st_size,
            "uploads_archive_size_bytes": uploads_archive.stat().st_size,
            "backup_type": record.backup_type.value,
            "backup_id": str(record.id),
        }
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2))
        record.progress_percent = 90
        db.commit()

        # pack staging → final.tar.gz (atomic)
        final_path = backup_path(record.filename)
        tmp_path = Path(str(final_path) + ".tmp")
        with tarfile.open(str(tmp_path), "w:gz") as tar:
            tar.add(str(staging), arcname=".")
        os.rename(str(tmp_path), str(final_path))
        record.progress_percent = 95
        db.commit()

        # finalize
        record.status = BackupStatus.completed
        record.file_path = str(final_path)
        record.file_size_bytes = final_path.stat().st_size
        record.manifest_json = json.dumps(manifest)
        record.completed_at = datetime.now(timezone.utc)
        record.progress_percent = 100
        db.commit()

        cleanup_old_backups_task.delay(record.backup_type.value)

        return {"backup_id": backup_id, "status": "completed"}

    except Exception as exc:
        logger.error("create_backup_task hatasi: %s", exc, exc_info=True)
        db.rollback()
        try:
            r = db.query(Backup).filter(Backup.id == backup_uuid).first()
            if r:
                r.status = BackupStatus.failed
                r.error_message = str(exc)[:2000]
                db.commit()
        except Exception:
            db.rollback()
        raise

    finally:
        if staging and staging.exists():
            shutil.rmtree(str(staging), ignore_errors=True)
        if record is not None:
            tmp = Path(str(backup_path(record.filename)) + ".tmp")
            if tmp.exists():
                tmp.unlink(missing_ok=True)
        db.close()


# ── Task 2: restore_backup_task ──────────────────────────────────────────────


@celery_app.task(
    name="app.modules.backups.tasks.restore_backup_task",
    bind=True,
    max_retries=0,
    time_limit=7200,
    soft_time_limit=7100,
)
def restore_backup_task(self, snap_id: str, target_backup_id: str) -> dict:
    from app.core.database import SessionLocal
    from app.modules.backups.models import Backup, BackupStatus
    from app.modules.backups.service import set_maintenance_mode
    from app.modules.backups.storage import backup_path, staging_dir, uploads_dir

    db = SessionLocal()
    snap_uuid = uuid.UUID(snap_id)
    target_uuid = uuid.UUID(target_backup_id)
    extract_dir = None

    try:
        snap = db.query(Backup).filter(Backup.id == snap_uuid).first()
        target = db.query(Backup).filter(Backup.id == target_uuid).first()
        if not snap or not target:
            raise RuntimeError("Backup kayitlari bulunamadi")

        # ── Phase 1: pre-restore snapshot (0→30) ──────────────────────────
        snap.status = BackupStatus.running
        snap.progress_percent = 5
        db.commit()

        stg = staging_dir(snap.filename)
        stg.mkdir(parents=True, exist_ok=True)

        _pg_dump(stg / "db.sql.gz")
        snap.progress_percent = 15
        db.commit()

        _tar_uploads(stg / "uploads.tar.gz", uploads_dir())
        snap.progress_percent = 25
        db.commit()

        snap_manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_type": "pre_restore",
            "restore_target_id": target_backup_id,
        }
        (stg / "manifest.json").write_text(json.dumps(snap_manifest))

        final_snap_path = backup_path(snap.filename)
        tmp_snap = Path(str(final_snap_path) + ".tmp")
        with tarfile.open(str(tmp_snap), "w:gz") as tar:
            tar.add(str(stg), arcname=".")
        os.rename(str(tmp_snap), str(final_snap_path))

        snap.status = BackupStatus.completed
        snap.file_path = str(final_snap_path)
        snap.file_size_bytes = final_snap_path.stat().st_size
        snap.manifest_json = json.dumps(snap_manifest)
        snap.completed_at = datetime.now(timezone.utc)
        snap.progress_percent = 30
        db.commit()
        shutil.rmtree(str(stg), ignore_errors=True)

        # ── Phase 2: extract target archive (30→40) ───────────────────────
        target.status = BackupStatus.restoring
        db.commit()

        target_archive = backup_path(target.filename)
        extract_dir = backup_path(target.filename).parent / f".restore-{target_uuid}"
        extract_dir.mkdir(parents=True, exist_ok=True)

        with tarfile.open(str(target_archive), "r:gz") as tar:
            tar.extractall(str(extract_dir))

        snap.progress_percent = 40
        db.commit()

        # ── Phase 3: DB restore (40→70) ───────────────────────────────────
        user, password, host, port, dbname = _parse_db_url()
        env = os.environ.copy()
        env["PGPASSWORD"] = password

        # Terminate existing connections
        subprocess.run(
            [
                "psql", "-U", user, "-h", host, "-p", port, "template1",
                "-c",
                f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                f"WHERE datname='{dbname}' AND pid <> pg_backend_pid();",
            ],
            env=env,
            check=True,
            capture_output=True,
        )

        subprocess.run(
            ["dropdb", "-U", user, "-h", host, "-p", port, "--if-exists", dbname],
            env=env,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["createdb", "-U", user, "-h", host, "-p", port, dbname],
            env=env,
            check=True,
            capture_output=True,
        )

        db_dump_file = extract_dir / "db.sql.gz"
        gunzip = subprocess.Popen(
            ["gunzip", "-c", str(db_dump_file)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        psql = subprocess.Popen(
            ["psql", "-U", user, "-h", host, "-p", port, dbname],
            stdin=gunzip.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        gunzip.stdout.close()
        _, psql_err = psql.communicate()
        gunzip.wait()
        if gunzip.returncode != 0:
            raise RuntimeError(
                f"gunzip basarisiz (arsiv bozuk olabilir): kod={gunzip.returncode}"
            )
        if psql.returncode != 0:
            raise RuntimeError(f"psql restore basarisiz: {psql_err.decode(errors='replace')[:1000]}")

        snap.progress_percent = 70
        db.commit()

        # ── Phase 4: uploads restore (70→90) ──────────────────────────────
        uploads_archive = extract_dir / "uploads.tar.gz"
        target_uploads = uploads_dir()
        uploads_bak = target_uploads.parent / (target_uploads.name + ".bak")

        if target_uploads.exists():
            if uploads_bak.exists():
                shutil.rmtree(str(uploads_bak))
            target_uploads.rename(uploads_bak)

        target_uploads.mkdir(parents=True, exist_ok=True)

        with tarfile.open(str(uploads_archive), "r:gz") as tar:
            for member in tar.getmembers():
                member.name = member.name.removeprefix("uploads/").lstrip("/")
                if member.name:
                    tar.extract(member, str(target_uploads))

        if uploads_bak.exists():
            shutil.rmtree(str(uploads_bak), ignore_errors=True)

        snap.progress_percent = 95
        db.commit()

        # ── Phase 5: finalize (95→100) ────────────────────────────────────
        shutil.rmtree(str(extract_dir), ignore_errors=True)
        extract_dir = None

        target.status = BackupStatus.completed
        snap.progress_percent = 100
        db.commit()

        set_maintenance_mode(False)

        cleanup_old_backups_task.delay("pre_restore")

        return {"snap_id": snap_id, "target_id": target_backup_id, "status": "restored"}

    except Exception as exc:
        logger.error("restore_backup_task hatasi: %s", exc, exc_info=True)
        db.rollback()
        try:
            from app.modules.backups.models import BackupStatus as BS  # re-import safe

            sn = db.query(Backup).filter(Backup.id == snap_uuid).first()
            if sn:
                sn.status = BS.failed
                sn.error_message = str(exc)[:2000]
                db.commit()
            tg = db.query(Backup).filter(Backup.id == target_uuid).first()
            if tg and tg.status == BS.restoring:
                tg.status = BS.completed
                db.commit()
        except Exception:
            db.rollback()
        from app.modules.backups.service import set_maintenance_mode as smm

        smm(False)
        raise

    finally:
        if extract_dir and extract_dir.exists():
            shutil.rmtree(str(extract_dir), ignore_errors=True)
        db.close()


# ── Task 3: cleanup_old_backups_task ─────────────────────────────────────────


@celery_app.task(name="app.modules.backups.tasks.cleanup_old_backups_task")
def cleanup_old_backups_task(backup_type_value: str) -> dict:
    from app.core.database import SessionLocal
    from app.modules.backups.models import Backup, BackupStatus, BackupType

    db = SessionLocal()
    deleted = 0
    try:
        btype = BackupType(backup_type_value)

        if btype == BackupType.pre_restore:
            cutoff = datetime.now(timezone.utc) - timedelta(
                days=settings.PRE_RESTORE_RETENTION_DAYS
            )
            old = (
                db.query(Backup)
                .filter(
                    Backup.backup_type == BackupType.pre_restore,
                    Backup.status == BackupStatus.completed,
                    Backup.created_at < cutoff,
                )
                .all()
            )
            for b in old:
                _delete_backup_file(b)
                db.delete(b)
                deleted += 1

        else:
            max_keep = (
                settings.MAX_MANUAL_BACKUPS
                if btype == BackupType.manual
                else settings.MAX_AUTO_BACKUPS
            )
            all_of_type = (
                db.query(Backup)
                .filter(
                    Backup.backup_type == btype,
                    Backup.status == BackupStatus.completed,
                )
                .order_by(Backup.created_at.desc())
                .all()
            )
            for old in all_of_type[max_keep:]:
                _delete_backup_file(old)
                db.delete(old)
                deleted += 1

        db.commit()
        return {"deleted": deleted, "type": backup_type_value}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Task 4: scheduled_auto_backup (Celery Beat) ──────────────────────────────


@celery_app.task(name="app.modules.backups.tasks.scheduled_auto_backup")
def scheduled_auto_backup() -> dict:
    from app.core.database import SessionLocal
    from app.modules.backups.models import Backup, BackupStatus, BackupType
    from app.modules.backups.storage import check_disk_space, make_filename

    db = SessionLocal()
    try:
        check_disk_space()

        ts = datetime.now(timezone.utc)
        filename = make_filename(ts)

        record = Backup(
            filename=filename,
            backup_type=BackupType.auto,
            status=BackupStatus.pending,
            created_by=None,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        task = create_backup_task.delay(str(record.id))
        record.task_id = task.id
        db.commit()

        return {"backup_id": str(record.id), "filename": filename}
    except Exception as exc:
        logger.error("scheduled_auto_backup hatasi: %s", exc, exc_info=True)
        db.rollback()
        return {"error": str(exc)}
    finally:
        db.close()
