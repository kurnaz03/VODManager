#!/bin/bash
# Kill all uvicorn, start as root with debug

pkill -9 -f uvicorn
sleep 3
echo "Killed. Now starting as root..."

sed -i 's/^DEBUG=.*/DEBUG=true/' /var/www/vod-manager/app/backend/.env

cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --log-level debug > /tmp/uv3.log 2>&1 &
UVPID=$!
echo "PID=$UVPID"
sleep 8

echo "=== Health ==="
curl -s http://127.0.0.1:8000/health

echo ""
TOKEN=$(python3 /tmp/gettoken.py 2>/dev/null)

python3 -c "
import urllib.request, json

TOKEN = open('/tmp/token.txt').read().strip() if __import__('os').path.exists('/tmp/token.txt') else ''
if not TOKEN:
    data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
    req = urllib.request.Request('http://127.0.0.1:8000/api/v1/auth/login', data=data, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        TOKEN = json.loads(resp.read())['access_token']
    open('/tmp/token.txt', 'w').write(TOKEN)
    print('Got token:', TOKEN[:20])

headers = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
data = json.dumps({'name': 'roottest001', 'description': 'root test'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        r = json.loads(resp.read())
        print('SUCCESS:', r.get('name'), 'id:', r.get('id'))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print('HTTP', e.code, ':', body[:300])
"

echo ""
echo "=== LOG ERRORS ==="
grep -i "error\|exception\|traceback\|easyrsa\|pkierr" /tmp/uv3.log 2>/dev/null | head -40

sed -i 's/^DEBUG=true/DEBUG=false/' /var/www/vod-manager/app/backend/.env
