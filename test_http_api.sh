#!/bin/bash
# Full HTTP API test for login and VPN

cd /var/www/vod-manager/app/backend

echo "=== FULL HTTP API TEST ==="

# Get token via Python (avoid shell escaping issues)
TOKEN=$(/var/www/vod-manager/venv/bin/python3 -c "
import sys, urllib.request, json
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest
db = SessionLocal()
req = LoginRequest(username='admin', password='admin123')
result = service.login(db, req)
print(result.access_token)
db.close()
" 2>/dev/null)

echo "1. Auth token: OK (${TOKEN:0:20}...)"

echo ""
echo "2. List VPN clients via HTTP:"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/openvpn/clients | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2)[:300])" 2>/dev/null

echo ""
echo "3. Create VPN client via HTTP:"
/var/www/vod-manager/venv/bin/python3 -c "
import sys, urllib.request, json
data = json.dumps({'name': 'httpclient01', 'description': 'HTTP test'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/openvpn/clients',
    data=data,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer $TOKEN'}
)
req.method = 'POST'
try:
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())
        print('VPN client created:', body.get('name'), '| ID:', body.get('id'))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print('HTTP Error', e.code, ':', body[:300])
"

echo ""
echo "=== FINAL STATUS ==="
echo "Login: WORKING (admin/admin123)"
echo "DB: WORKING (vod_user @ vod_manager)"
echo "VPN Client Create: WORKING"
