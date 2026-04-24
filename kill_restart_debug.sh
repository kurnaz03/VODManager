#!/bin/bash
# Kill all uvicorn and restart with debug

# Kill all uvicorn processes
pkill -9 -f uvicorn 2>/dev/null
sleep 3
echo "Processes after kill:"
ps aux | grep uvicorn | grep -v grep | head -5 || echo "No uvicorn running"

echo ""
echo "Port status:"
ss -tlnp | grep 8000 || echo "Port 8000 is free"

echo ""
echo "Setting DEBUG=true..."
sed -i 's/^DEBUG=.*/DEBUG=true/' /var/www/vod-manager/app/backend/.env
grep "^DEBUG" /var/www/vod-manager/app/backend/.env

echo ""
echo "Starting uvicorn with debug..."
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level debug \
    > /tmp/uv_dbg.log 2>&1 &
UVPID=$!
echo "New PID: $UVPID"
sleep 8

echo "Health:"
curl -s http://127.0.0.1:8000/health

echo ""
echo "=== VPN CREATE TEST ==="
TOKEN=$(python3 -c "
import sys, urllib.request, json
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/auth/login', data=data, method='POST', headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    print(json.loads(resp.read())['access_token'])
" 2>/dev/null)

echo "Token: ${TOKEN:0:20}..."

python3 << PYEOF
import urllib.request, json, sys

TOKEN = "$TOKEN"
headers = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
data = json.dumps({'name': 'newvpnclient01', 'description': 'test'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/openvpn/clients',
    data=data, method='POST', headers=headers
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        r = json.loads(resp.read())
        print(f'SUCCESS: {r}')
except urllib.error.HTTPError as e:
    print(f'HTTP Error {e.code}:')
    body = e.read().decode()
    try:
        print(json.dumps(json.loads(body), indent=2))
    except:
        print(body[:500])
PYEOF

echo ""
echo "=== UVICORN LOG (last 60 lines) ==="
tail -60 /tmp/uv_dbg.log 2>/dev/null

# Restore debug=false
sed -i 's/^DEBUG=true/DEBUG=false/' /var/www/vod-manager/app/backend/.env
echo ""
echo "DEBUG restored to false"
