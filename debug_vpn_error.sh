#!/bin/bash
# Start uvicorn with DEBUG=true and capture full error

cd /var/www/vod-manager/app/backend

# Temporarily set DEBUG=true in .env
sed -i 's/^DEBUG=false/DEBUG=true/' /var/www/vod-manager/app/backend/.env
grep DEBUG /var/www/vod-manager/app/backend/.env

# Start uvicorn
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level debug \
    > /tmp/uv_debug2.log 2>&1 &
UVPID=$!
echo "Uvicorn started: $UVPID"
sleep 8

# Test health
curl -s http://127.0.0.1:8000/health

echo ""
echo "=== VPN create with error details ==="

# Get token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)
echo "Token: ${TOKEN:0:20}..."

# Create VPN client
curl -v -X POST http://127.0.0.1:8000/api/v1/openvpn/clients \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"newvc200","description":"test"}' 2>&1

echo ""
echo "=== Uvicorn log (error section) ==="
grep -A30 "ERROR\|Exception\|Traceback\|easyrsa\|permission" /tmp/uv_debug2.log | head -80

# Restore debug=false
sed -i 's/^DEBUG=true/DEBUG=false/' /var/www/vod-manager/app/backend/.env
