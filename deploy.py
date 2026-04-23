#!/usr/bin/env python3
"""
VOD Manager Production Deployment Script
Connects to Ubuntu 24 server and deploys the full application stack
"""
import subprocess
import sys
import os
import time

# Install paramiko if not available
try:
    import paramiko
except ImportError:
    print("Installing paramiko...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "scp"])
    import paramiko

from paramiko import SSHClient, AutoAddPolicy
import io

# Server config
HOST = "62.210.92.252"
PORT = 22
USER = "root"
PASSWORD = "Kia2014x"

# Generated secure values
DB_PASSWORD = "V0dM@n4g3r_P@ss_2024_xK9mZ"
JWT_SECRET = "a8f3c91e7b2d4f6a9c0e1b3d5f7a9c0e1b3d5f7a9c0e1b3d5f7a9c0e1b3d5f7a9"
FERNET_KEY = "R20En0g5vwt2xveT0zaIN4eh4iG_YzcbAfT81-xvL-A="

def get_client():
    client = SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    return client

def run(client, cmd, timeout=120, check_error=True):
    print(f"\n>>> {cmd[:100]}...")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(f"[OUT] {out[:500]}")
    if err and exit_code != 0:
        print(f"[ERR] {err[:300]}")
    if check_error and exit_code != 0:
        # Non-fatal for some commands
        print(f"[WARN] Exit code {exit_code}")
    return out, err, exit_code

def upload_file(client, local_path, remote_path):
    from scp import SCPClient
    with SCPClient(client.get_transport(), socket_timeout=60) as scp:
        scp.put(local_path, remote_path, recursive=True)
    print(f"[UPLOAD] {local_path} -> {remote_path}")

def upload_dir_sftp(client, local_dir, remote_dir):
    """Upload directory via SFTP recursively"""
    sftp = client.open_sftp()
    
    def mkdir_p(path):
        try:
            sftp.mkdir(path)
        except:
            pass
    
    def upload_recursive(local, remote):
        mkdir_p(remote)
        for item in os.listdir(local):
            if item in ['__pycache__', '.git', 'node_modules', '.env', 'dist', 'venv', '.venv']:
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

def main():
    print("=" * 60)
    print("VOD MANAGER PRODUCTION DEPLOYMENT")
    print("=" * 60)
    
    client = get_client()
    print("[OK] SSH baglantisi kuruldu")

    # =========================================
    # STEP 1: System update and package install
    # =========================================
    print("\n[STEP 1] Sistem guncelleme ve paket kurulumu...")
    
    run(client, "apt-get update -qq", timeout=180)
    run(client, "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq", timeout=300)
    
    run(client, """DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        nginx postgresql postgresql-contrib redis-server \
        python3 python3-venv python3-pip python3-dev \
        ffmpeg git curl wget ufw fail2ban \
        libpq-dev gcc build-essential""", timeout=300)
    
    # Node.js 20 LTS
    run(client, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -", timeout=60)
    run(client, "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs", timeout=120)
    
    # yt-dlp
    run(client, "curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp", timeout=60)
    
    out, _, _ = run(client, "node --version && npm --version && python3 --version", check_error=False)
    print(f"[VERSION] {out.strip()}")

    # =========================================
    # STEP 2: Directory structure
    # =========================================
    print("\n[STEP 2] Dizin yapisi olusturuluyor...")
    run(client, """
mkdir -p /var/www/vod-manager/app/backend
mkdir -p /var/www/vod-manager/app/frontend
mkdir -p /var/www/vod-manager/app/frontend-dist
mkdir -p /var/www/vod-manager/shared/env
mkdir -p /var/www/vod-manager/shared/logs
mkdir -p /var/www/vod-manager/shared/uploads
mkdir -p /var/www/vod-manager/shared/uploads/logos
mkdir -p /var/www/vod-manager/shared/cookies
mkdir -p /var/www/vod-manager/shared/hls
mkdir -p /var/www/vod-manager/venv
""")

    # =========================================
    # STEP 3: PostgreSQL setup
    # =========================================
    print("\n[STEP 3] PostgreSQL ve Redis kurulumu...")
    run(client, "systemctl enable postgresql redis-server && systemctl start postgresql redis-server")
    
    # Create DB and user
    run(client, f"""sudo -u postgres psql -c "DROP DATABASE IF EXISTS vod_manager;" 2>/dev/null; true""", check_error=False)
    run(client, f"""sudo -u postgres psql -c "DROP USER IF EXISTS vod_user;" 2>/dev/null; true""", check_error=False)
    run(client, f"""sudo -u postgres psql -c "CREATE USER vod_user WITH PASSWORD '{DB_PASSWORD}';" """)
    run(client, f"""sudo -u postgres psql -c "CREATE DATABASE vod_manager OWNER vod_user;" """)
    run(client, f"""sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vod_manager TO vod_user;" """)
    
    # Test Redis
    out, _, _ = run(client, "redis-cli ping", check_error=False)
    print(f"[REDIS] {out.strip()}")

    # =========================================
    # STEP 4: Upload backend files
    # =========================================
    print("\n[STEP 4] Backend dosyalari yukleniyor...")
    local_backend = r"C:\Users\kurna\Projects\VODManager\backend"
    upload_dir_sftp(client, local_backend, "/var/www/vod-manager/app/backend")
    print("[OK] Backend dosyalari yuklendi")

    # =========================================
    # STEP 5: Python venv and pip install
    # =========================================
    print("\n[STEP 5] Python venv ve bagimliliklar kuruluyor...")
    run(client, "python3 -m venv /var/www/vod-manager/venv", timeout=60)
    run(client, "/var/www/vod-manager/venv/bin/pip install --upgrade pip wheel -q", timeout=60)
    run(client, f"/var/www/vod-manager/venv/bin/pip install -r /var/www/vod-manager/app/backend/requirements.txt -q", timeout=180)
    
    # Also install asyncpg for async DB
    run(client, "/var/www/vod-manager/venv/bin/pip install asyncpg -q", timeout=60)
    run(client, "/var/www/vod-manager/venv/bin/python -m playwright install chromium", timeout=300)
    
    print("[OK] Python bagimliliklar kuruldu")

    # =========================================
    # STEP 6: Create .env file
    # =========================================
    print("\n[STEP 6] .env dosyasi olusturuluyor...")
    env_content = f"""APP_NAME=VOD Manager
DEBUG=false
SECRET_KEY={JWT_SECRET}
ALLOWED_ORIGINS=http://62.210.92.252,http://62.210.92.252:80

DATABASE_URL=postgresql+asyncpg://vod_user:{DB_PASSWORD}@localhost:5432/vod_manager
SYNC_DATABASE_URL=postgresql+psycopg2://vod_user:{DB_PASSWORD}@localhost:5432/vod_manager

REDIS_URL=redis://localhost:6379/0

JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SETUP=3/minute
FERNET_KEY={FERNET_KEY}
SHARED_STORAGE_ROOT=/var/www/vod-manager/shared
MAIN_SERVER_NAME=Main Server
MAIN_SERVER_IP={HOST}
MAIN_SERVER_SSH_PORT=22
MAIN_SERVER_SSH_USERNAME=root
MAIN_SERVER_SSH_PASSWORD={PASSWORD}
"""
    
    # Write env file via SFTP
    sftp = client.open_sftp()
    with sftp.open("/var/www/vod-manager/shared/env/backend.env", 'w') as f:
        f.write(env_content)
    # Also create symlink in backend dir for alembic
    with sftp.open("/var/www/vod-manager/app/backend/.env", 'w') as f:
        f.write(env_content)
    sftp.close()
    print("[OK] .env dosyasi olusturuldu")

    # =========================================
    # STEP 7: Database migration
    # =========================================
    print("\n[STEP 7] Veritabani migration calistiriliyor...")
    
    # Check if alembic versions exist
    out, _, rc = run(client, "ls /var/www/vod-manager/app/backend/alembic/versions/ 2>/dev/null | wc -l", check_error=False)
    version_count = out.strip()
    print(f"[INFO] Mevcut migration sayisi: {version_count}")
    
    if version_count == "0" or version_count == "":
        # No migrations yet, create initial one
        run(client, """cd /var/www/vod-manager/app/backend && \
            /var/www/vod-manager/venv/bin/python -c \
            "from app.core.database import Base, engine, SessionLocal; from app.modules.users.models import *; from app.modules.servers.models import *; from app.modules.content.models import *; from app.modules.content.seed import ensure_default_categories; from app.modules.servers.service import ensure_main_server; Base.metadata.create_all(bind=engine); db=SessionLocal(); ensure_main_server(db); ensure_default_categories(db); db.close()"
        """, timeout=60)
        print("[OK] Tablolar create_all ile olusturuldu")
    else:
        run(client, "cd /var/www/vod-manager/app/backend && /var/www/vod-manager/venv/bin/alembic upgrade head", timeout=60)
        print("[OK] Alembic migration tamamlandi")
    
    # Seed roles
    run(client, """cd /var/www/vod-manager/app/backend && \
        /var/www/vod-manager/venv/bin/python -c \
        "from app.core.database import SessionLocal; from app.modules.roles.seed import seed_roles; from app.modules.content.seed import ensure_default_categories; from app.modules.servers.service import ensure_main_server; db=SessionLocal(); seed_roles(db); ensure_main_server(db); ensure_default_categories(db); db.close(); print('Roller, kategoriler ve main server seed edildi')"
    """, timeout=30)

    # =========================================
    # STEP 8: Upload frontend and build
    # =========================================
    print("\n[STEP 8] Frontend dosyalari yukleniyor ve build ediliyor...")
    local_frontend = r"C:\Users\kurna\Projects\VODManager\frontend"
    upload_dir_sftp(client, local_frontend, "/var/www/vod-manager/app/frontend")
    
    run(client, "cd /var/www/vod-manager/app/frontend && npm install --silent", timeout=300)
    run(client, "cd /var/www/vod-manager/app/frontend && npm run build", timeout=180)
    
    # Copy dist to frontend-dist
    run(client, "cp -r /var/www/vod-manager/app/frontend/dist/* /var/www/vod-manager/app/frontend-dist/")
    print("[OK] Frontend build tamamlandi")

    # =========================================
    # STEP 9: File permissions
    # =========================================
    print("\n[STEP 9] Dosya izinleri ayarlaniyor...")
    run(client, """
chown -R www-data:www-data /var/www/vod-manager/
chmod -R 755 /var/www/vod-manager/
chmod -R 750 /var/www/vod-manager/shared/env/
chmod 640 /var/www/vod-manager/shared/env/backend.env
chmod 640 /var/www/vod-manager/app/backend/.env
chmod 700 /var/www/vod-manager/shared/cookies/
touch /var/www/vod-manager/shared/cookies/youtube_cookies.txt
chmod 600 /var/www/vod-manager/shared/cookies/youtube_cookies.txt
""")

    # =========================================
    # STEP 10: Nginx configuration
    # =========================================
    print("\n[STEP 10] Nginx konfigurasyonu...")
    nginx_conf = """server {
    listen 80;
    server_name 62.210.92.252;

    # Frontend â€” React build
    root /var/www/vod-manager/app/frontend-dist;
    index index.html;

    client_max_body_size 2G;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        client_max_body_size 2G;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }

    # HLS / stream segmentleri
    location /streams/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control "no-cache";
        add_header Access-Control-Allow-Origin "*";
        types {
            application/vnd.apple.mpegurl m3u8;
            video/MP2T ts;
        }
    }

    # React SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
}
"""
    sftp = client.open_sftp()
    with sftp.open("/etc/nginx/sites-available/vod-manager", 'w') as f:
        f.write(nginx_conf)
    sftp.close()
    
    run(client, "ln -sf /etc/nginx/sites-available/vod-manager /etc/nginx/sites-enabled/vod-manager")
    run(client, "rm -f /etc/nginx/sites-enabled/default")
    run(client, "nginx -t", check_error=False)
    run(client, "systemctl enable nginx && systemctl restart nginx")
    print("[OK] Nginx konfigurasyonu tamamlandi")

    # =========================================
    # STEP 11: Systemd service
    # =========================================
    print("\n[STEP 11] Systemd servisi olusturuluyor...")
    service_content = """[Unit]
Description=VOD Manager API (FastAPI)
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/var/www/vod-manager/app/backend
Environment="PATH=/var/www/vod-manager/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
EnvironmentFile=/var/www/vod-manager/shared/env/backend.env
ExecStart=/var/www/vod-manager/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --log-level info --access-log
Restart=always
RestartSec=5
StandardOutput=append:/var/www/vod-manager/shared/logs/api.log
StandardError=append:/var/www/vod-manager/shared/logs/api-error.log

[Install]
WantedBy=multi-user.target
"""
    sftp = client.open_sftp()
    with sftp.open("/etc/systemd/system/vod-manager-api.service", 'w') as f:
        f.write(service_content)
    celery_worker_content = """[Unit]
Description=VOD Manager Celery Worker
After=network.target redis.service postgresql.service
Wants=redis.service postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/vod-manager/app/backend
Environment="PATH=/var/www/vod-manager/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
EnvironmentFile=/var/www/vod-manager/shared/env/backend.env
ExecStart=/var/www/vod-manager/venv/bin/celery -A app.core.celery_app.celery_app worker --beat --loglevel=info
Restart=always
RestartSec=5
StandardOutput=append:/var/www/vod-manager/shared/logs/celery.log
StandardError=append:/var/www/vod-manager/shared/logs/celery-error.log

[Install]
WantedBy=multi-user.target
"""
    with sftp.open("/etc/systemd/system/vod-manager-celery.service", 'w') as f:
        f.write(celery_worker_content)
    sftp.close()
    
    run(client, "systemctl daemon-reload")
    run(client, "systemctl enable vod-manager-api")
    run(client, "systemctl enable vod-manager-celery")
    run(client, "systemctl start vod-manager-api", check_error=False)
    run(client, "systemctl start vod-manager-celery", check_error=False)
    
    time.sleep(5)
    out, _, _ = run(client, "systemctl status vod-manager-api --no-pager -l", check_error=False)
    print(f"[SERVICE STATUS]\n{out[:600]}")

    # =========================================
    # STEP 12: Firewall
    # =========================================
    print("\n[STEP 12] Firewall (ufw) ayarlaniyor...")
    run(client, "ufw --force reset", check_error=False)
    run(client, "ufw default deny incoming")
    run(client, "ufw default allow outgoing")
    run(client, "ufw allow 22/tcp")
    run(client, "ufw allow 80/tcp")
    run(client, "ufw allow 443/tcp")
    run(client, "ufw --force enable")
    out, _, _ = run(client, "ufw status", check_error=False)
    print(f"[UFW] {out}")

    # =========================================
    # STEP 13: Verification
    # =========================================
    print("\n[STEP 13] Dogrulama...")
    time.sleep(3)
    
    # Check API
    out, _, rc = run(client, "curl -s http://127.0.0.1:8000/health", check_error=False)
    print(f"[HEALTH] {out}")
    
    out, _, rc = run(client, "curl -s http://127.0.0.1:8000/api/v1/setup/status", check_error=False)
    print(f"[SETUP STATUS] {out}")
    
    out, _, rc = run(client, "curl -s http://127.0.0.1/api/v1/setup/status", check_error=False)
    print(f"[NGINX->API] {out}")
    
    out, _, rc = run(client, "curl -s http://127.0.0.1/api/v1/settings/theme", check_error=False)
    print(f"[THEME SETTINGS] {out}")
    
    # Check logs
    out, _, _ = run(client, "tail -20 /var/www/vod-manager/shared/logs/api-error.log 2>/dev/null || echo 'No error log'", check_error=False)
    if "error" in out.lower() or "Error" in out:
        print(f"[WARN] Error logs:\n{out[:400]}")
    
    # Services status
    for svc in ["postgresql", "redis-server", "nginx", "vod-manager-api", "vod-manager-celery"]:
        out, _, _ = run(client, f"systemctl is-active {svc}", check_error=False)
        status = "ACTIVE" if "active" in out else "FAILED"
        print(f"[{status}] {svc}")
    
    print("\n" + "=" * 60)
    print("DEPLOYMENT TAMAMLANDI!")
    print("=" * 60)
    print(f"Frontend: http://{HOST}/")
    print(f"Setup:    http://{HOST}/api/v1/setup/status")
    print(f"Health:   http://{HOST}/health")
    print(f"DB Pass:  {DB_PASSWORD}")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    main()
