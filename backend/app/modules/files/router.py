import os
import stat as stat_module
from pathlib import Path
from typing import Optional

import paramiko
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.modules.auth.router import get_current_user_id
from app.core.database import get_db
from app.core.security import decrypt_secret
from app.modules.servers.models import Server

router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(get_current_user_id)])

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".ts", ".m3u8", ".mov", ".wmv", ".flv"}


def _ssh_browse(server: Server, path: str) -> dict:
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=server.ip_address,
            port=server.ssh_port,
            username=server.ssh_username,
            password=decrypt_secret(server.ssh_password),
            timeout=10,
        )
        sftp = client.open_sftp()

        try:
            entries = sftp.listdir_attr(path)
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dizin bulunamadi: {path}",
            )
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dizin okunamadi",
            )

        entries.sort(key=lambda e: (not stat_module.S_ISDIR(e.st_mode or 0), (e.filename or '').lower()))

        dirs = []
        files = []

        for entry in entries:
            fname = entry.filename or ''
            if fname.startswith('.'):
                continue
            entry_path = path.rstrip('/') + '/' + fname
            if stat_module.S_ISDIR(entry.st_mode or 0):
                dirs.append({"name": fname, "path": entry_path, "type": "dir"})
            else:
                ext = Path(fname).suffix.lower()
                if ext in VIDEO_EXTENSIONS:
                    files.append({
                        "name": fname,
                        "path": entry_path,
                        "type": "file",
                        "size": entry.st_size,
                        "ext": ext,
                    })

        sftp.close()
        client.close()

    except HTTPException:
        raise
    except paramiko.AuthenticationException:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SSH kimlik dogrulama hatasi",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSH baglantisi hatasi: {str(e)}",
        )

    # Compute parent path
    parent_path = path.rstrip('/').rsplit('/', 1)[0] if '/' in path.rstrip('/') else None
    if parent_path == '':
        parent_path = '/'
    # Allow navigating up from root (parent of "/" is None)
    if path.rstrip('/') == '' or path == '/':
        parent_path = None

    return {
        "current_path": path,
        "parent_path": parent_path,
        "dirs": dirs,
        "files": files,
    }


@router.get("/browse")
def browse_files(
    path: str = Query(default="/"),
    server_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    # Remote server browsing via SSH
    if server_id is not None:
        server = db.query(Server).filter(Server.id == server_id).first()
        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sunucu bulunamadi",
            )
        return _ssh_browse(server, path)

    # Local file browsing - full access, no directory restrictions
    target = Path(path)

    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dizin bulunamadi: {path}",
        )

    if not target.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Belirtilen yol bir dizin degil",
        )

    dirs = []
    files = []

    try:
        entries = sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                dirs.append({"name": entry.name, "path": str(entry), "type": "dir"})
            elif entry.is_file():
                ext = entry.suffix.lower()
                if ext in VIDEO_EXTENSIONS:
                    size = entry.stat().st_size
                    files.append({
                        "name": entry.name,
                        "path": str(entry),
                        "type": "file",
                        "size": size,
                        "ext": ext,
                    })
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dizin okunamadi",
        )

    parent = str(target.parent) if str(target.parent) != str(target) else None

    return {
        "current_path": str(target),
        "parent_path": parent,
        "dirs": dirs,
        "files": files,
    }
