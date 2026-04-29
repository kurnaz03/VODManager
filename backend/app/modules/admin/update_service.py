import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path("/var/www/vod-manager/app")
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def _run(cmd: list[str], cwd: Path = PROJECT_ROOT, timeout: int = 60) -> tuple[int, str, str]:
    env = {
        "PATH": "/var/www/vod-manager/venv/bin:/usr/local/bin:/usr/bin:/bin",
        "HOME": "/root",
        "GIT_CONFIG_NOSYSTEM": "1",
    }
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        logger.error("Command timed out: %s", " ".join(cmd))
        raise RuntimeError(f"Komut zaman asimina ugradi: {' '.join(cmd)}")
    except FileNotFoundError as exc:
        logger.error("Command not found: %s", " ".join(cmd))
        raise RuntimeError(f"Komut bulunamadi: {cmd[0]}") from exc


def check_update() -> dict:
    # Fetch latest refs from remote (no checkout)
    _run(["git", "fetch", "origin", "main"], timeout=30)

    # Current local HEAD
    rc, local_commit, err = _run(["git", "rev-parse", "HEAD"])
    if rc != 0:
        raise RuntimeError(f"Yerel commit alinamadi: {err}")

    # Latest remote commit
    rc, remote_commit, err = _run(["git", "rev-parse", "origin/main"])
    if rc != 0:
        raise RuntimeError(f"Remote commit alinamadi: {err}")

    local_commit = local_commit[:12]
    remote_commit = remote_commit[:12]

    # Fetch last remote commit message
    rc, remote_msg, _ = _run(["git", "log", "-1", "--pretty=%s", "origin/main"])
    remote_commit_message = remote_msg if rc == 0 else ""

    update_available = local_commit != remote_commit

    return {
        "current_commit": local_commit,
        "remote_commit": remote_commit,
        "update_available": update_available,
        "remote_commit_message": remote_commit_message,
    }


def apply_update() -> dict:
    # Save current commit before update
    rc, old_commit, err = _run(["git", "rev-parse", "HEAD"])
    if rc != 0:
        raise RuntimeError(f"Mevcut commit alinamadi: {err}")
    old_commit = old_commit[:12]

    logger.info("Guncelleme basliyor: mevcut commit=%s", old_commit)

    # Stash any local changes (deploy edits etc.)
    _run(["git", "stash"], timeout=15)

    # git pull
    rc, out, err = _run(["git", "pull", "origin", "main"], timeout=120)
    if rc != 0:
        msg = f"git pull basarisiz: {err or out}"
        logger.error(msg)
        raise RuntimeError(msg)
    logger.info("git pull tamamlandi: %s", out)

    # Fix dist folder permissions before build
    dist_dir = FRONTEND_DIR / "dist"
    _run(["chown", "-R", "root:root", str(dist_dir)], timeout=15)
    _run(["chmod", "-R", "755", str(dist_dir)], timeout=15)
    logger.info("dist klasoru izinleri duzeltildi")

    # npm run build
    rc, out, err = _run(["npm", "run", "build"], cwd=FRONTEND_DIR, timeout=300)
    if rc != 0:
        msg = f"npm build basarisiz: {err or out}"
        logger.error(msg)
        raise RuntimeError(msg)
    logger.info("npm build tamamlandi")

    # systemctl restart
    rc, out, err = _run(
        ["sudo", "systemctl", "restart", "vod-manager-api", "vod-manager-worker"],
        timeout=30,
    )
    if rc != 0:
        msg = f"systemctl restart basarisiz: {err or out}"
        logger.error(msg)
        raise RuntimeError(msg)
    logger.info("Servisler yeniden baslatildi")

    rc, new_commit, _ = _run(["git", "rev-parse", "HEAD"])
    new_commit = new_commit[:12] if rc == 0 else "bilinmiyor"

    return {
        "success": True,
        "old_commit": old_commit,
        "new_commit": new_commit,
        "message": f"Guncelleme tamamlandi: {old_commit} -> {new_commit}",
    }
