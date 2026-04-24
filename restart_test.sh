#!/bin/bash
# Restart uvicorn and test VPN

echo "=== Kill old uvicorn ==="
pkill -f uvicorn 2>/dev/null
sleep 3

echo "=== Check port 8000 ==="
ss -tlnp | grep 8000 || echo "Port 8000 free"

echo "=== Start new uvicorn ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /tmp/uv_new.log 2>&1 &
echo "Uvicorn PID: $!"
sleep 7

echo ""
echo "=== Health ==="
curl -s http://127.0.0.1:8000/health

echo ""
echo "=== Full API test ==="
/var/www/vod-manager/venv/bin/python3 << 'EOF'
import urllib.request, json

BASE = 'http://127.0.0.1:8000'

# Login
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(BASE + '/api/v1/auth/login', data=data, method='POST',
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    token = json.loads(resp.read())['access_token']
print(f'Login: OK')

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Create VPN client
data = json.dumps({'name': 'final001', 'description': 'Final test'}).encode()
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        client = json.loads(resp.read())
        print(f'VPN client created: name={client["name"]} id={client["id"]} active={client["is_active"]}')
except urllib.error.HTTPError as e:
    err = e.read().decode()
    print(f'HTTP {e.code}: {err[:400]}')

# List clients
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    clients = json.loads(resp.read())
print(f'Total VPN clients: {len(clients)}')
for c in clients:
    print(f'  - {c["name"]} id:{c["id"]} active:{c["is_active"]}')
EOF

echo ""
echo "=== Uvicorn log ==="
tail -20 /tmp/uv_new.log 2>/dev/null
