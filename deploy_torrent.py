#!/usr/bin/env python3
"""
Torrent feature incremental deployment
Uploads only changed files, installs libtorrent, rebuilds frontend, restarts services.
"""
import subprocess
import sys
import os
import time

try:
    import paramiko
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "scp"])
    import paramiko

from paramiko import SSHClient, AutoAddPolicy

HOST = "62.210.92.252"
PORT = 22
USER = "root"
PASSWORD = "Kia2014x"


def get_client():
    client = SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    return client


def run(client, cmd, timeout=120, check_error=True):
    print(f"\n>>> {cmd[:120]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(f"[OUT] {out[:600]}")
    if err.strip() and exit_code != 0:
        print(f"[ERR] {err[:300]}")
    return out, err, exit_code


def upload_dir_sftp(client, local_dir, remote_dir):
    sftp = client.open_sftp()

    def mkdir_p(path):
        try:
            sftp.mkdir(path)
        except Exception:
            pass

    def upload_recursive(local, remote):
        mkdir_p(remote)
        for item in os.listdir(local):
            if item in ['__pycache__', '.git', 'node_modules', '.env', 'dist', 'venv', '.venv', '*.pyc']:
                continue
            local_path = os.path.join(local, item)
            remote_path = f"{remote}/{item}"
            if os.path.isdir(local_path):
                upload_recursive(local_path, remote_path)
            else:
                try:
                    sftp.put(local_path, remote_path)
                    print(f"  -> {remote_path}")
                except Exception as e:
                    print(f"  [SKIP] {remote_path}: {e}")

    upload_recursive(local_dir, remote_dir)
    sftp.close()


def upload_file_sftp(client, local_path, remote_path):
    sftp = client.open_sftp()
    try:
        sftp.put(local_path, remote_path)
        print(f"  -> {remote_path}")
    finally:
        sftp.close()


def main():
    print("=" * 60)
    print("TORRENT FEATURE DEPLOY")
    print("=" * 60)

    client = get_client()
    print("[OK] SSH connected")

    # 1. Install libtorrent
    print("\n[STEP 1] libtorrent kuruluyor...")
    run(client, "apt-get install -y python3-libtorrent 2>&1 || pip install python-libtorrent 2>&1", timeout=180)
    # Also try pip install as fallback
    run(client, "/var/www/vod-manager/venv/bin/pip install python-libtorrent 2>&1 || true", timeout=120, check_error=False)

    # 2. Create torrent download directory
    print("\n[STEP 2] Torrent dizini olusturuluyor...")
    run(client, "mkdir -p /var/www/vod-manager/shared/downloads/torrents && chown -R www-data:www-data /var/www/vod-manager/shared/downloads/ && chmod 755 /var/www/vod-manager/shared/downloads/torrents")

    # 3. Upload backend torrent module
    print("\n[STEP 3] Backend torrent modulu yukleniyor...")
    local_torrent = r"C:\Users\kurna\Projects\VODManager\backend\app\modules\torrent"
    remote_torrent = "/var/www/vod-manager/app/backend/app/modules/torrent"
    run(client, f"mkdir -p {remote_torrent}")
    upload_dir_sftp(client, local_torrent, remote_torrent)

    # 4. Upload updated core files
    print("\n[STEP 4] Guncellenmis core dosyalar yukleniyor...")
    files_to_upload = [
        (r"C:\Users\kurna\Projects\VODManager\backend\app\api\v1\router.py",
         "/var/www/vod-manager/app/backend/app/api/v1/router.py"),
        (r"C:\Users\kurna\Projects\VODManager\backend\app\main.py",
         "/var/www/vod-manager/app/backend/app/main.py"),
        (r"C:\Users\kurna\Projects\VODManager\backend\app\core\celery_app.py",
         "/var/www/vod-manager/app/backend/app/core/celery_app.py"),
        (r"C:\Users\kurna\Projects\VODManager\backend\app\core\config.py",
         "/var/www/vod-manager/app/backend/app/core/config.py"),
    ]
    for local_f, remote_f in files_to_upload:
        upload_file_sftp(client, local_f, remote_f)

    # 5. Upload frontend source
    print("\n[STEP 5] Frontend torrent sayfasi yukleniyor...")
    local_torrent_fe = r"C:\Users\kurna\Projects\VODManager\frontend\src\modules\torrent"
    remote_torrent_fe = "/var/www/vod-manager/app/frontend/src/modules/torrent"
    run(client, f"mkdir -p {remote_torrent_fe}/pages {remote_torrent_fe}/services")
    upload_dir_sftp(client, local_torrent_fe, remote_torrent_fe)

    # Upload updated sidebar, router, layout
    fe_files = [
        (r"C:\Users\kurna\Projects\VODManager\frontend\src\components\layout\Sidebar.tsx",
         "/var/www/vod-manager/app/frontend/src/components/layout/Sidebar.tsx"),
        (r"C:\Users\kurna\Projects\VODManager\frontend\src\components\layout\DashboardLayout.tsx",
         "/var/www/vod-manager/app/frontend/src/components/layout/DashboardLayout.tsx"),
        (r"C:\Users\kurna\Projects\VODManager\frontend\src\app\router\index.tsx",
         "/var/www/vod-manager/app/frontend/src/app/router/index.tsx"),
    ]
    for local_f, remote_f in fe_files:
        upload_file_sftp(client, local_f, remote_f)

    # 6. Rebuild frontend
    print("\n[STEP 6] Frontend build ediliyor...")
    run(client, "cd /var/www/vod-manager/app/frontend && npm run build", timeout=180)
    run(client, "cp -rf /var/www/vod-manager/app/frontend/dist/* /var/www/vod-manager/app/frontend-dist/")
    print("[OK] Frontend build tamamlandi")

    # 7. Restart services
    print("\n[STEP 7] Servisler yeniden baslatiliyor...")
    run(client, "systemctl restart vod-manager-api", check_error=False)
    run(client, "systemctl restart vod-manager-celery", check_error=False)
    time.sleep(5)

    # 8. Verify
    print("\n[STEP 8] Dogrulama...")
    out, _, _ = run(client, "curl -s http://127.0.0.1:8000/health", check_error=False)
    print(f"[HEALTH] {out}")

    out, _, _ = run(client, "systemctl is-active vod-manager-api vod-manager-celery", check_error=False)
    print(f"[SERVICES] {out}")

    # Check torrent endpoint available
    out, _, _ = run(client, "curl -s http://127.0.0.1:8000/api/v1/torrent -o /dev/null -w '%{http_code}'", check_error=False)
    print(f"[TORRENT API HTTP CODE] {out.strip()} (401=auth required = OK)")

    # Check libtorrent availability in venv
    out, _, _ = run(client, "/var/www/vod-manager/venv/bin/python -c 'import libtorrent; print(\"libtorrent OK:\", libtorrent.version)' 2>&1", check_error=False)
    print(f"[LIBTORRENT] {out.strip()}")

    print("\n" + "=" * 60)
    print("TORRENT DEPLOY TAMAMLANDI!")
    print(f"URL: http://{HOST}/torrent")
    print("=" * 60)

    client.close()


if __name__ == "__main__":
    main()
