#!/usr/bin/env python3
"""
Xtream Codes API uyumluluğu deploy scripti
- player_api.php / panel_api.php endpoint'lerini yükler
- Nginx konfigürasyonunu günceller
- Servisi yeniden başlatır
"""
import subprocess
import sys

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

ROUTER_LOCAL = r"C:\Users\kurna\Projects\VODManager\backend\app\modules\stream\router.py"
ROUTER_REMOTE = "/var/www/vod-manager/app/backend/app/modules/stream/router.py"

NGINX_LOCAL = r"C:\Users\kurna\Projects\VODManager\infra\nginx\vod-manager.conf"
NGINX_TMP   = "/tmp/vod-manager-nginx.conf"
NGINX_DEST  = "/etc/nginx/sites-enabled/vod-manager"


def get_client():
    client = SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    return client


def run(client, cmd, timeout=60, check_error=True):
    print(f">>> {cmd[:120]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc = stdout.channel.recv_exit_status()
    if out.strip():
        print(f"    {out.strip()[:400]}")
    if err.strip() and rc != 0:
        print(f"    [ERR] {err.strip()[:300]}")
    return out, err, rc


def upload_text(client, local_path, remote_path):
    """Upload a file via SFTP, stripping BOM if present."""
    with open(local_path, "rb") as f:
        content = f.read()
    # Strip UTF-8 BOM
    if content.startswith(b"\xef\xbb\xbf"):
        content = content[3:]
    sftp = client.open_sftp()
    with sftp.open(remote_path, "wb") as rf:
        rf.write(content)
    sftp.close()
    print(f"[UPLOAD] {local_path} -> {remote_path}")


def main():
    print("=" * 60)
    print("XTREAM CODES API DEPLOY")
    print("=" * 60)

    client = get_client()
    print("[OK] SSH bağlantısı kuruldu")

    # 1. router.py yükle
    print("\n[1] router.py yükleniyor...")
    upload_text(client, ROUTER_LOCAL, ROUTER_REMOTE)

    # 2. Nginx konfig yükle (/tmp -> /etc/nginx/sites-enabled)
    print("\n[2] Nginx konfig yükleniyor...")
    upload_text(client, NGINX_LOCAL, NGINX_TMP)
    run(client, f"cp {NGINX_TMP} {NGINX_DEST}")

    # 3. Nginx test & reload
    print("\n[3] Nginx test ve reload...")
    out, err, rc = run(client, "nginx -t", check_error=False)
    if rc != 0:
        print(f"[FAIL] nginx -t başarısız:\n{err}")
        client.close()
        return
    run(client, "nginx -s reload")
    print("[OK] Nginx yeniden yüklendi")

    # 4. API servisini yeniden başlat
    print("\n[4] vod-manager-api servisi yeniden başlatılıyor...")
    run(client, "systemctl restart vod-manager-api")
    import time; time.sleep(4)

    # 5. Test
    print("\n[5] Test ediliyor...")
    user = "user_0uh1hmth"
    pwd  = "et2k4yy14rno"
    for action in ["", "&action=get_live_categories", "&action=get_series"]:
        url = f"'http://localhost:8080/player_api.php?username={user}&password={pwd}{action}'"
        out, _, rc = run(client, f"curl -s {url} | python3 -m json.tool 2>&1 | head -20", timeout=30, check_error=False)
        label = action or "(no action)"
        print(f"\n--- {label} ---\n{out[:600]}")

    print("\n" + "=" * 60)
    print("DEPLOY TAMAMLANDI")
    print("=" * 60)
    client.close()


if __name__ == "__main__":
    main()
