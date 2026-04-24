#!/bin/bash
# Restart uvicorn with debug and capture VPN error

# Kill existing
pkill -f uvicorn 2>/dev/null
sleep 2

# Start with debug logging to file
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level debug \
    --access-log \
    > /tmp/uvicorn_debug.log 2>&1 &
UVPID=$!
echo "Uvicorn PID: $UVPID"

sleep 6
echo "Health:"
curl -s http://127.0.0.1:8000/health && echo ""

# Get token
TOKEN=$(/var/www/vod-manager/venv/bin/python3 -c "
import urllib.request, json
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/auth/login', data=data, method='POST', headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    body = json.loads(resp.read())
    print(body['access_token'])
" 2>/dev/null)

echo "Token: ${TOKEN:0:20}..."

# Make VPN create request
curl -s -X POST http://127.0.0.1:8000/api/v1/openvpn/clients \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"vpndebug01","description":"debug"}' 2>&1

echo ""
echo "=== Uvicorn debug log (last 80 lines) ==="
tail -80 /tmp/uvicorn_debug.log
