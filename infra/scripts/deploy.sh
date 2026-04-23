#!/bin/bash
# VOD Manager — Ubuntu 24 Production Deploy Script
# Kullanim: bash deploy.sh
# Sunucu: 62.210.92.252, Hedef: /var/www/vod-manager

set -e

PROJECT_DIR="/var/www/vod-manager"
BACKEND_DIR="$PROJECT_DIR/app/backend"
FRONTEND_DIR="$PROJECT_DIR/app/frontend-dist"
SHARED_DIR="$PROJECT_DIR/shared"
VENV_DIR="$PROJECT_DIR/venv"
LOGS_DIR="$SHARED_DIR/logs"
ENV_DIR="$SHARED_DIR/env"

echo "=== VOD Manager Deploy Basliyor ==="

# 1. Dizin yapisi
echo "[1/10] Dizin yapisi olusturuluyor..."
mkdir -p "$BACKEND_DIR" "$FRONTEND_DIR" "$SHARED_DIR/uploads" \
         "$SHARED_DIR/hls" "$LOGS_DIR" "$ENV_DIR"

# 2. Sistem bagimliliklari
echo "[2/10] Sistem bagimliliklari kuruluyor..."
apt-get update -qq
apt-get install -y -qq \
    nginx postgresql postgresql-contrib redis-server \
    python3 python3-venv python3-pip python3-dev \
    ffmpeg git curl ufw fail2ban \
    build-essential libpq-dev

# yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

# Node.js 20 (frontend build icin)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. PostgreSQL kurulumu
echo "[3/10] PostgreSQL ayarlaniyor..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='voduser'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER voduser WITH PASSWORD 'vodpassword';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='vodmanager'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE vodmanager OWNER voduser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vodmanager TO voduser;"

# 4. Redis
echo "[4/10] Redis kontrol ediliyor..."
systemctl enable redis-server
systemctl start redis-server

# 5. Python venv ve backend bagimliliklari
echo "[5/10] Python venv olusturuluyor..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements/base.txt" -q

# 6. Environment dosyasi
echo "[6/10] Environment dosyasi kontrol ediliyor..."
ENV_FILE="$ENV_DIR/backend.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "UYARI: $ENV_FILE bulunamadi. Ornek olusturuluyor..."
    cat > "$ENV_FILE" << 'EOF'
APP_NAME=VOD Manager
APP_VERSION=1.0.0
DEBUG=false
SECRET_KEY=CHANGE_ME_IN_PRODUCTION_AT_LEAST_32_CHARS
DATABASE_URL=postgresql+asyncpg://voduser:vodpassword@localhost:5432/vodmanager
SYNC_DATABASE_URL=postgresql+psycopg2://voduser:vodpassword@localhost:5432/vodmanager
REDIS_URL=redis://localhost:6379/0
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=http://62.210.92.252
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SETUP=3/minute
EOF
    echo "  ONEMLI: $ENV_FILE icindeki SECRET_KEY degerini degistirin!"
fi

# 7. Frontend build
echo "[7/10] Frontend build aliniyor..."
TEMP_FE=$(mktemp -d)
cp -r /tmp/vod-manager-frontend/* "$TEMP_FE/" 2>/dev/null || true
if [ -d "$TEMP_FE/frontend" ]; then
    cd "$TEMP_FE/frontend"
    npm install --silent
    npm run build --silent
    cp -r dist/* "$FRONTEND_DIR/"
    cd -
fi

# 8. Nginx
echo "[8/10] Nginx ayarlaniyor..."
cp "$PROJECT_DIR/infra/nginx/vod-manager.conf" /etc/nginx/sites-available/vod-manager
ln -sf /etc/nginx/sites-available/vod-manager /etc/nginx/sites-enabled/vod-manager
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

# 9. Systemd servisleri
echo "[9/10] Systemd servisleri ayarlaniyor..."
chown -R www-data:www-data "$PROJECT_DIR"

cp "$PROJECT_DIR/infra/systemd/vod-manager-api.service" /etc/systemd/system/
cp "$PROJECT_DIR/infra/systemd/vod-manager-worker.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable vod-manager-api vod-manager-worker
systemctl restart vod-manager-api vod-manager-worker

# 10. Firewall
echo "[10/10] Firewall ayarlaniyor..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "=== Deploy Tamamlandi ==="
echo "Panel: http://62.210.92.252"
echo "API:   http://62.210.92.252/api/docs (DEBUG=true ise)"
echo "Log:   $LOGS_DIR/"
echo ""
echo "Servis durumu:"
systemctl status vod-manager-api --no-pager -l | tail -5
