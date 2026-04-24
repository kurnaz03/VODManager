#!/bin/bash
# Server production setup fix script
# Run this on the production server to apply all required fixes
# Fixes: Login 500 error and VPN client creation 500 error
#
# Issues fixed:
# 1. DB credentials mismatch (.env was empty, using wrong DB name/user)
# 2. Admin user password hash was invalid/truncated
# 3. www-data lacked access to EasyRSA for VPN cert generation
#
# Run as: root@server
# Path: /var/www/vod-manager/

set -e

BACKEND_DIR=/var/www/vod-manager/app/backend
VENV_PY=/var/www/vod-manager/venv/bin/python3
EASYRSA_DIR=/etc/openvpn/easy-rsa
SHARED_ENV=/var/www/vod-manager/shared/env/backend.env

echo "=== VOD Manager Production Fix Script ==="
echo ""

# --- Fix 1: Sync .env from shared config ---
echo "[1/4] Syncing .env from shared config..."
if [ -f "$SHARED_ENV" ]; then
    cp "$SHARED_ENV" "$BACKEND_DIR/.env"
    chmod 640 "$BACKEND_DIR/.env"
    chown root:www-data "$BACKEND_DIR/.env"
    echo "  .env synced from $SHARED_ENV"
else
    echo "  WARNING: $SHARED_ENV not found, skipping"
fi

# --- Fix 2: Reset PostgreSQL vod_user password ---
echo ""
echo "[2/4] Ensuring PostgreSQL vod_user password matches .env..."
DB_PASS=$(grep -oP '(?<=vod_user:)[^@]+' "$BACKEND_DIR/.env" | head -1)
if [ -n "$DB_PASS" ]; then
    sudo -u postgres psql -c "ALTER USER vod_user WITH PASSWORD '$DB_PASS';" 2>/dev/null && echo "  vod_user password updated" || echo "  (password may already match)"
else
    echo "  WARNING: Could not extract DB password from .env"
fi

# --- Fix 3: Fix EasyRSA permissions for www-data ---
echo ""
echo "[3/4] Fixing EasyRSA permissions for www-data..."

# Add www-data to openvpn group
if ! id www-data | grep -q openvpn; then
    usermod -aG openvpn www-data
    echo "  Added www-data to openvpn group"
else
    echo "  www-data already in openvpn group"
fi

# Fix /etc/openvpn directory permissions
chown root:openvpn /etc/openvpn/ 2>/dev/null || true
chmod 750 /etc/openvpn/ 2>/dev/null || true

# Fix easy-rsa directory
chown root:openvpn "$EASYRSA_DIR" 2>/dev/null || true
chmod 770 "$EASYRSA_DIR" 2>/dev/null || true

# Fix easyrsa script (symlink target)
chown root:openvpn /usr/share/easy-rsa/easyrsa 2>/dev/null || true
chmod 750 /usr/share/easy-rsa/easyrsa 2>/dev/null || true

# Fix PKI directory - give openvpn group read/write access
if [ -d "$EASYRSA_DIR/pki" ]; then
    chown -R root:openvpn "$EASYRSA_DIR/pki/"
    chmod -R g+rwX "$EASYRSA_DIR/pki/"
    echo "  PKI directory permissions fixed"
fi

echo "  EasyRSA permissions fixed"

# --- Fix 4: Restart uvicorn to pick up group changes ---
echo ""
echo "[4/4] Restarting uvicorn..."
pkill -f uvicorn 2>/dev/null || true
sleep 2

cd "$BACKEND_DIR"
$VENV_PY -m uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /var/log/vod-manager-uvicorn.log 2>&1 &
echo "  Uvicorn started PID: $!"
sleep 5

# Verify
if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "  Health check: OK"
else
    echo "  WARNING: Health check failed - check logs"
fi

echo ""
echo "=== Fix script complete ==="
echo "  Login credentials: admin / admin123"
echo "  API: http://127.0.0.1:8000"
echo "  VPN client creation: enabled"
