#!/usr/bin/env bash
# =============================================================================
# VOD Manager - Automatic installer for Ubuntu 22.04 / 24.04
# Usage: sudo bash install.sh
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/vod-manager"
APP_SRC="${APP_DIR}/app"
SHARED_DIR="${APP_DIR}/shared"
VENV_DIR="${APP_DIR}/venv"
ENV_DIR="${SHARED_DIR}/env"
ENV_FILE="${ENV_DIR}/backend.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo bash install.sh"

# --- Detect OS ---
. /etc/os-release
[[ "$ID" == "ubuntu" && ("$VERSION_ID" == "22.04" || "$VERSION_ID" == "24.04") ]] \
  || warn "Tested on Ubuntu 22.04/24.04. Proceeding anyway on $PRETTY_NAME."

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║       VOD Manager Installer            ║"
echo "  ╚════════════════════════════════════════╝"
echo ""

# ─── 1. System packages ───────────────────────────────────────────────────────
info "Updating package lists..."
apt-get update -qq

info "Installing dependencies (nginx, postgresql, redis, python3, ffmpeg, node)..."
apt-get install -y -qq \
  curl wget gnupg2 lsb-release ca-certificates \
  nginx \
  postgresql postgresql-contrib \
  redis-server \
  python3 python3-pip python3-venv python3-dev \
  ffmpeg \
  build-essential libpq-dev \
  ufw \
  git

# Node 18 via NodeSource
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | tr -d 'v' | cut -d. -f1) -lt 18 ]]; then
  info "Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
success "Node $(node -v), npm $(npm -v)"

# ─── 2. Ask for server IP ──────────────────────────────────────────────────────
echo ""
read -rp "Enter this server's public IP address: " SERVER_IP
[[ -z "$SERVER_IP" ]] && error "Server IP cannot be empty."

# ─── 3. PostgreSQL setup ──────────────────────────────────────────────────────
info "Configuring PostgreSQL..."
systemctl enable --now postgresql >/dev/null 2>&1

DB_PASSWORD=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24)
DB_NAME="vod_manager"
DB_USER="vod_user"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
success "PostgreSQL: database '${DB_NAME}' ready"

# ─── 4. Redis ─────────────────────────────────────────────────────────────────
info "Starting Redis..."
systemctl enable --now redis-server >/dev/null 2>&1
success "Redis started"

# ─── 5. Directory structure ───────────────────────────────────────────────────
info "Creating directory structure..."
mkdir -p "${APP_SRC}/backend" "${APP_SRC}/frontend"
mkdir -p "${SHARED_DIR}/uploads" "${SHARED_DIR}/hls" "${SHARED_DIR}/transcode" \
         "${SHARED_DIR}/logs" "${ENV_DIR}"

# ─── 6. Copy source code ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"

info "Copying backend source..."
cp -r "${REPO_ROOT}/backend/." "${APP_SRC}/backend/"

info "Copying frontend source..."
cp -r "${REPO_ROOT}/frontend/." "${APP_SRC}/frontend/"

# ─── 7. Generate secrets ──────────────────────────────────────────────────────
info "Generating secrets..."
SECRET_KEY=$(openssl rand -hex 32)
FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || \
             python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")

# ─── 8. backend.env ───────────────────────────────────────────────────────────
info "Creating backend.env..."
cat > "${ENV_FILE}" <<EOF
APP_NAME=VOD Manager
DEBUG=false
SECRET_KEY=${SECRET_KEY}
ALLOWED_ORIGINS=http://${SERVER_IP},http://${SERVER_IP}:80

DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
SYNC_DATABASE_URL=postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
REDIS_URL=redis://localhost:6379/0

JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SETUP=3/minute

FERNET_KEY=${FERNET_KEY}

SHARED_STORAGE_ROOT=${SHARED_DIR}

MAIN_SERVER_NAME=Main Server
MAIN_SERVER_IP=${SERVER_IP}
MAIN_SERVER_SSH_PORT=22
MAIN_SERVER_SSH_USERNAME=root
MAIN_SERVER_SSH_PASSWORD=CHANGE_ME

PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
EOF
chmod 600 "${ENV_FILE}"
success "backend.env created at ${ENV_FILE}"

# ─── 9. Python venv + pip install ─────────────────────────────────────────────
info "Creating Python virtualenv..."
python3 -m venv "${VENV_DIR}"
"${VENV_DIR}/bin/pip" install --upgrade pip -q

REQ_FILE="${APP_SRC}/backend/requirements/base.txt"
[[ ! -f "$REQ_FILE" ]] && REQ_FILE="${APP_SRC}/backend/requirements.txt"
[[ -f "$REQ_FILE" ]] || error "requirements file not found"

info "Installing Python packages (this may take a few minutes)..."
"${VENV_DIR}/bin/pip" install -r "$REQ_FILE" -q
success "Python packages installed"

# ─── 10. Database migrations ──────────────────────────────────────────────────
info "Running Alembic migrations..."
cd "${APP_SRC}/backend"
set +u; . "${VENV_DIR}/bin/activate"; set -u
# source env so alembic can read DATABASE_URL
set -a; . "${ENV_FILE}"; set +a
alembic upgrade head || warn "Alembic migration failed — run manually later"
deactivate 2>/dev/null || true
cd /

# ─── 11. Frontend build ───────────────────────────────────────────────────────
info "Building frontend..."
cd "${APP_SRC}/frontend"
npm ci --silent
npm run build --silent
FRONTEND_DIST="${APP_DIR}/app/frontend-dist"
mkdir -p "${FRONTEND_DIST}"
cp -r dist/. "${FRONTEND_DIST}/"
success "Frontend built → ${FRONTEND_DIST}"
cd /

# ─── 12. Nginx ────────────────────────────────────────────────────────────────
info "Configuring nginx..."
NGINX_CONF="${REPO_ROOT}/infra/nginx/vod-manager.conf"
sed "s/YOUR_SERVER_IP/${SERVER_IP}/g" "$NGINX_CONF" \
  > /etc/nginx/sites-available/vod-manager
ln -sf /etc/nginx/sites-available/vod-manager /etc/nginx/sites-enabled/vod-manager
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx
success "Nginx configured"

# ─── 13. Systemd services ─────────────────────────────────────────────────────
info "Installing systemd services..."
cp "${REPO_ROOT}/infra/systemd/vod-manager-api.service"    /etc/systemd/system/
cp "${REPO_ROOT}/infra/systemd/vod-manager-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vod-manager-api
systemctl enable --now vod-manager-worker
success "Services enabled and started"

# ─── 14. File ownership ───────────────────────────────────────────────────────
info "Setting file ownership..."
chown -R www-data:www-data "${APP_DIR}/app" "${FRONTEND_DIST}" "${SHARED_DIR}/uploads" \
  "${SHARED_DIR}/hls" "${SHARED_DIR}/transcode" "${SHARED_DIR}/logs"
chmod -R 755 "${FRONTEND_DIST}"

# ─── 15. UFW firewall ─────────────────────────────────────────────────────────
info "Configuring firewall..."
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 8080/tcp >/dev/null
ufw --force enable >/dev/null
success "UFW: ports 22, 80, 8080 open"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Installation Complete!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Panel:       ${BLUE}http://${SERVER_IP}/${NC}"
echo -e "  API Docs:    ${BLUE}http://${SERVER_IP}/api/docs${NC}"
echo -e "  Stream port: ${BLUE}http://${SERVER_IP}:8080/${NC}"
echo ""
echo -e "  DB user:     ${YELLOW}${DB_USER}${NC}"
echo -e "  DB password: ${YELLOW}${DB_PASSWORD}${NC}  (also in ${ENV_FILE})"
echo ""
echo -e "  ${YELLOW}IMPORTANT:${NC} Edit ${ENV_FILE} and set:"
echo    "    - MAIN_SERVER_SSH_PASSWORD"
echo    "    - MAIN_SERVER_IP (if different)"
echo ""
echo -e "  Logs: ${SHARED_DIR}/logs/"
echo ""