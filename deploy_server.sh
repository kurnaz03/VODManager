#!/bin/bash
set -e

DB_PASS="V0dM4n4g3r_Pr0d_2024_xK9mZ"
JWT_SECRET="a8f3c91e7b2d4f6a9c0e1b3d5f7a9c0e1b3d5f7a9c0e1b3d5f7a9c0e1b3d5f7a9"
HOST_IP="62.210.92.252"
FERNET_KEY="R20En0g5vwt2xveT0zaIN4eh4iG_YzcbAfT81-xvL-A="

echo "============================================================"
echo "VOD MANAGER PRODUCTION DEPLOYMENT"
echo "============================================================"

# =========================================
# STEP 1: PostgreSQL & Redis
# =========================================
echo ""
echo "[STEP 1] PostgreSQL veritabani kurulumu..."
systemctl start postgresql redis-server 2>/dev/null || true

sudo -u postgres psql -c "DROP DATABASE IF EXISTS vod_manager;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS vod_user;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER vod_user WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE vod_manager OWNER vod_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vod_manager TO vod_user;"

# Test Redis
REDIS_STATUS=$(redis-cli ping 2>/dev/null || echo "FAILED")
echo "[REDIS] $REDIS_STATUS"
echo "[OK] Veritabani ve Redis hazir"

# =========================================
# STEP 2: Python venv
# =========================================
echo ""
echo "[STEP 2] Python virtual environment olusturuluyor..."
python3 -m venv /var/www/vod-manager/venv
/var/www/vod-manager/venv/bin/pip install --upgrade pip wheel --quiet
echo "[OK] venv hazir"

# =========================================
# STEP 3: Backend pip install
# =========================================
echo ""
echo "[STEP 3] Python bagimliliklar kuruluyor..."
/var/www/vod-manager/venv/bin/pip install -r /var/www/vod-manager/app/backend/requirements.txt --quiet
/var/www/vod-manager/venv/bin/pip install asyncpg --quiet
/var/www/vod-manager/venv/bin/python -m playwright install chromium
echo "[OK] Bagimliliklar kuruldu"

# =========================================
# STEP 4: .env dosyasi
# =========================================
echo ""
echo "[STEP 4] .env dosyasi olusturuluyor..."
cat > /var/www/vod-manager/shared/env/backend.env << EOF
APP_NAME=VOD Manager
DEBUG=false
SECRET_KEY=${JWT_SECRET}
ALLOWED_ORIGINS=http://${HOST_IP},http://${HOST_IP}:80

DATABASE_URL=postgresql+asyncpg://vod_user:${DB_PASS}@localhost:5432/vod_manager
SYNC_DATABASE_URL=postgresql+psycopg2://vod_user:${DB_PASS}@localhost:5432/vod_manager

REDIS_URL=redis://localhost:6379/0

JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SETUP=3/minute
FERNET_KEY=${FERNET_KEY}
SHARED_STORAGE_ROOT=/var/www/vod-manager/shared
MAIN_SERVER_NAME=Main Server
MAIN_SERVER_IP=${HOST_IP}
MAIN_SERVER_SSH_PORT=22
MAIN_SERVER_SSH_USERNAME=root
MAIN_SERVER_SSH_PASSWORD=Kia2014x
EOF

# Symlink backend'in kendi .env'i iÃ§in
cp /var/www/vod-manager/shared/env/backend.env /var/www/vod-manager/app/backend/.env
chmod 640 /var/www/vod-manager/shared/env/backend.env
chmod 640 /var/www/vod-manager/app/backend/.env
echo "[OK] .env dosyasi olusturuldu"

# =========================================
# STEP 5: Database tables (create_all)
# =========================================
echo ""
echo "[STEP 5] Veritabani tablolari olusturuluyor..."
cd /var/www/vod-manager/app/backend

/var/www/vod-manager/venv/bin/python -c "
import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.database import Base, engine, SessionLocal
from app.modules.users.models import User, Role, UserRoleAssignment, RefreshToken, SystemSetting, ActivityLog
from app.modules.servers.models import Server, ServerMetric, ServerInstallLog
from app.modules.settings.models import YoutubeCookieCredential
from app.modules.content.models import MovieCategory, SeriesCategory, TvCategory, RadioCategory, Bouquet, BouquetCategory
from app.modules.content.seed import ensure_default_categories
from app.modules.servers.service import ensure_main_server
Base.metadata.create_all(bind=engine)
db = SessionLocal()
ensure_main_server(db)
ensure_default_categories(db)
db.close()
print('Tablolar olusturuldu')
"

# Rol seed
/var/www/vod-manager/venv/bin/python -c "
import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.database import SessionLocal
from app.modules.roles.seed import seed_roles
from app.modules.content.seed import ensure_default_categories
from app.modules.servers.service import ensure_main_server
db = SessionLocal()
try:
    seed_roles(db)
    ensure_main_server(db)
    ensure_default_categories(db)
    print('Roller, kategoriler ve main server seed edildi')
finally:
    db.close()
"
echo "[OK] Veritabani hazir"

# =========================================
# STEP 6: Frontend build
# =========================================
echo ""
echo "[STEP 6] Frontend build ediliyor..."
cd /var/www/vod-manager/app/frontend
npm install --silent 2>&1 | tail -3
npm run build 2>&1 | tail -5

# Copy dist to frontend-dist
cp -r /var/www/vod-manager/app/frontend/dist/* /var/www/vod-manager/app/frontend-dist/
echo "[OK] Frontend build tamamlandi"

# =========================================
# STEP 7: Dosya izinleri
# =========================================
echo ""
echo "[STEP 7] Dosya izinleri ayarlaniyor..."
chown -R www-data:www-data /var/www/vod-manager/
chmod -R 755 /var/www/vod-manager/
chmod -R 750 /var/www/vod-manager/shared/env/
chmod 640 /var/www/vod-manager/shared/env/backend.env
chmod 640 /var/www/vod-manager/app/backend/.env
mkdir -p /var/www/vod-manager/shared/uploads/logos
mkdir -p /var/www/vod-manager/shared/cookies
chmod 700 /var/www/vod-manager/shared/cookies
touch /var/www/vod-manager/shared/cookies/youtube_cookies.txt
chmod 600 /var/www/vod-manager/shared/cookies/youtube_cookies.txt
# venv bin'e execute izni
chmod +x /var/www/vod-manager/venv/bin/uvicorn
echo "[OK] Izinler ayarlandi"

# =========================================
# STEP 8: Nginx konfigurasyonu
# =========================================
echo ""
echo "[STEP 8] Nginx konfigurasyonu..."
cat > /etc/nginx/sites-available/vod-manager << 'NGINX_EOF'
server {
    listen 80;
    server_name 62.210.92.252;

    root /var/www/vod-manager/app/frontend-dist;
    index index.html;

    client_max_body_size 2G;

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

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }

    location /streams/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control "no-cache";
        add_header Access-Control-Allow-Origin "*";
        types {
            application/vnd.apple.mpegurl m3u8;
            video/MP2T ts;
        }
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/vod-manager /etc/nginx/sites-enabled/vod-manager
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
echo "[OK] Nginx konfigurasyonu tamamlandi"

# =========================================
# STEP 9: Systemd servisi
# =========================================
echo ""
echo "[STEP 9] Systemd servisi olusturuluyor..."
cat > /etc/systemd/system/vod-manager-api.service << 'SERVICE_EOF'
[Unit]
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
SERVICE_EOF

cat > /etc/systemd/system/vod-manager-celery.service << 'CELERY_EOF'
[Unit]
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
CELERY_EOF

systemctl daemon-reload
systemctl enable vod-manager-api
systemctl enable vod-manager-celery
systemctl start vod-manager-api
systemctl start vod-manager-celery
sleep 5
systemctl status vod-manager-api --no-pager -l | head -20
systemctl status vod-manager-celery --no-pager -l | head -20
echo "[OK] Systemd servisi baslatildi"

# =========================================
# STEP 10: Firewall
# =========================================
echo ""
echo "[STEP 10] Firewall ayarlaniyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
echo "[OK] Firewall ayarlandi"

# =========================================
# STEP 11: Dogrulama
# =========================================
echo ""
echo "[STEP 11] Dogrulama..."
sleep 3

echo -n "Health check: "
curl -s http://127.0.0.1:8000/health || echo "FAILED"

echo -n "Setup status (direct): "
curl -s http://127.0.0.1:8000/api/v1/setup/status || echo "FAILED"

echo -n "Setup status (via nginx): "
curl -s http://127.0.0.1/api/v1/setup/status || echo "FAILED"

echo -n "Theme settings (via nginx): "
curl -s http://127.0.0.1/api/v1/settings/theme || echo "FAILED"

echo ""
echo "Servis durumu:"
for svc in postgresql redis-server nginx vod-manager-api vod-manager-celery; do
    STATUS=$(systemctl is-active $svc)
    echo "  [$STATUS] $svc"
done

echo ""
echo "============================================================"
echo "DEPLOYMENT TAMAMLANDI!"
echo "============================================================"
echo "Frontend:   http://${HOST_IP}/"
echo "API Health: http://${HOST_IP}/health"
echo "Setup:      http://${HOST_IP}/api/v1/setup/status"
echo "DB Pass:    ${DB_PASS}"
echo "============================================================"
