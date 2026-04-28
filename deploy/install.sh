#!/bin/bash
set -e

echo "========================================="
echo "  VOD Manager Panel - Otomatik Kurulum"
echo "========================================="

# --- Degiskenler ---
APP_DIR="/var/www/vod-manager"
REPO_URL="https://github.com/kurnaz03/VODManager.git"
DB_NAME="vod_manager"
DB_USER="vod_user"
DB_PASS="V0dM4n4g3r_Pr0d_2024_xK9mZ"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo "[1/10] Sistem paketleri guncelleniyor..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip python3-dev \
    postgresql postgresql-contrib redis-server nginx \
    ffmpeg git curl build-essential libpq-dev

echo "[2/10] Node.js 20 kuruluyor..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "Node: $(node --version), npm: $(npm --version)"

echo "[3/10] PostgreSQL ayarlaniyor..."
systemctl enable --now postgresql
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\" | grep -q 1 || psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\" | grep -q 1 || psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\""
echo "PostgreSQL OK"

echo "[4/10] Redis ayarlaniyor..."
systemctl enable --now redis-server
echo "Redis OK"

echo "[5/10] Repo klonlaniyor..."
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/app/.git" ]; then
    echo "Repo zaten mevcut, pull yapiliyor..."
    cd "$APP_DIR/app" && git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR/app"
fi

echo "[6/10] Backend kuruluyor..."
cd "$APP_DIR/app/backend"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip -q
"$APP_DIR/venv/bin/pip" install -r requirements.txt -q 2>/dev/null || "$APP_DIR/venv/bin/pip" install \
    fastapi uvicorn[standard] sqlalchemy psycopg2-binary alembic \
    celery[redis] redis httpx python-multipart python-jose[cryptography] \
    argon2-cffi pydantic pydantic-settings aiofiles jinja2 -q
"$APP_DIR/venv/bin/pip" install yt-dlp -q
echo "Backend OK"

echo "[7/10] Backend env ve DB migration..."
mkdir -p "$APP_DIR/shared/env" "$APP_DIR/shared/logs" "$APP_DIR/shared/uploads/movies" "$APP_DIR/shared/hls"

cat > "$APP_DIR/shared/env/backend.env" << EOF
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SYNC_DATABASE_URL=postgresql+psycopg2://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=*
SERVER_HOST=${SERVER_IP}
SHARED_STORAGE_PATH=${APP_DIR}/shared
EOF

cd "$APP_DIR/app/backend"
export DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
export SYNC_DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY=$(openssl rand -hex 32)
export SHARED_STORAGE_PATH="${APP_DIR}/shared"
export SERVER_HOST="${SERVER_IP}"

PYTHONPATH="$APP_DIR/app/backend" "$APP_DIR/venv/bin/python" -c "
from app.core.database import engine, Base
from app.modules.users.models import *
from app.modules.content.models import *
from app.modules.tv.models import *
from app.modules.iptv_users.models import *
from app.modules.downloads.models import *
from app.modules.playlist.models import *
from app.modules.transcode.models import *
from app.modules.connections.models import *
from app.modules.servers.models import *
Base.metadata.create_all(bind=engine)
print('DB tables created')
"

# Admin kullanici olustur
PYTHONPATH="$APP_DIR/app/backend" "$APP_DIR/venv/bin/python" -c "
from app.core.database import SessionLocal
from app.modules.users.models import User, Role, UserRoleAssignment
from app.core.security import hash_password
db = SessionLocal()
if not db.query(User).filter(User.username=='${ADMIN_USER}').first():
    u = User(username='${ADMIN_USER}', email='admin@localhost', password_hash=hash_password('${ADMIN_PASS}'))
    db.add(u)
    db.flush()
    role = db.query(Role).filter(Role.code=='super_admin').first()
    if not role:
        role = Role(code='super_admin', name='Super Admin')
        db.add(role)
        db.flush()
    assignment = UserRoleAssignment(user_id=u.id, role_id=role.id)
    db.add(assignment)
    db.commit()
    print('Admin user created')
else:
    print('Admin user exists')
db.close()
"
echo "DB + Admin OK"

echo "[8/10] Frontend kuruluyor..."
cd "$APP_DIR/app/frontend"
npm install --legacy-peer-deps 2>&1 | tail -3
npm run build 2>&1 | tail -3
ln -sfn "$APP_DIR/app/frontend/dist" "$APP_DIR/frontend-dist"
echo "Frontend OK"

echo "[9/10] Systemd servisleri olusturuluyor..."
cat > /etc/systemd/system/vod-manager-api.service << EOF
[Unit]
Description=VOD Manager API (FastAPI)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}/app/backend
Environment=PATH=${APP_DIR}/venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=HOME=/root
EnvironmentFile=${APP_DIR}/shared/env/backend.env
ExecStart=${APP_DIR}/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --log-level info --access-log
Restart=always
RestartSec=5
StandardOutput=append:${APP_DIR}/shared/logs/api.log
StandardError=append:${APP_DIR}/shared/logs/api-error.log

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vod-manager-worker.service << EOF
[Unit]
Description=VOD Manager Worker (Celery)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${APP_DIR}/app/backend
Environment=PATH=${APP_DIR}/venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=HOME=/root
EnvironmentFile=${APP_DIR}/shared/env/backend.env
ExecStart=${APP_DIR}/venv/bin/celery -A app.core.celery_app worker --beat --loglevel=info --concurrency=2 -n worker@%H
Restart=always
RestartSec=5
StandardOutput=append:${APP_DIR}/shared/logs/worker.log
StandardError=append:${APP_DIR}/shared/logs/worker-error.log

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "$APP_DIR/shared"
chown -R www-data:www-data "$APP_DIR/app"
chmod -R 755 "$APP_DIR/shared/uploads"
git config --global --add safe.directory "$APP_DIR/app"

systemctl daemon-reload
systemctl enable --now vod-manager-api vod-manager-worker
echo "Services OK"

echo "[10/10] Nginx ayarlaniyor..."
cat > /etc/nginx/sites-available/vod-manager << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 500M;

    location / {
        root /var/www/vod-manager/frontend-dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location /uploads/ {
        alias /var/www/vod-manager/shared/uploads/;
    }
}

server {
    listen 8080;
    server_name _;

    client_max_body_size 500M;

    location /get.php {
        proxy_pass http://127.0.0.1:8000/get.php;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /player_api.php {
        proxy_pass http://127.0.0.1:8000/player_api.php;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /panel_api.php {
        proxy_pass http://127.0.0.1:8000/panel_api.php;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-for $proxy_add_x_forwarded_for;
    }

    location /live/ {
        proxy_pass http://127.0.0.1:8000/live/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /movie/ {
        proxy_pass http://127.0.0.1:8000/movie/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /series/ {
        proxy_pass http://127.0.0.1:8000/series/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/vod-manager /etc/nginx/sites-enabled/vod-manager
nginx -t && systemctl reload nginx
echo "Nginx OK"

echo ""
echo "========================================="
echo "  KURULUM TAMAMLANDI!"
echo "========================================="
echo "  Panel:  http://${SERVER_IP}"
echo "  Admin:  ${ADMIN_USER} / ${ADMIN_PASS}"
echo "  IPTV:   http://${SERVER_IP}:8080"
echo "========================================="
