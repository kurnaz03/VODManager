#!/bin/bash
# Full test using only HTTP API - check VPN 500 error detail

VENV_PY=/var/www/vod-manager/venv/bin/python3

$VENV_PY << 'PYEOF'
import urllib.request, json, sys

BASE = 'http://127.0.0.1:8000'

# Login
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(BASE + '/api/v1/auth/login', data=data, method='POST',
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    login_data = json.loads(resp.read())
token = login_data['access_token']
print(f'Login: OK token={token[:20]}...')

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Try to create VPN client with verbose error
data = json.dumps({'name': 'vpnclient100', 'description': 'HTTP test'}).encode()
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        client = json.loads(resp.read())
        print(f'VPN client created: {client["name"]} id:{client["id"]}')
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f'HTTP {e.code} Error:')
    print(err_body)
PYEOF

echo ""
echo "=== Uvicorn process log ==="
ls /var/log/syslog 2>/dev/null && grep -i "uvicorn\|fastapi\|openvpn\|easyrsa" /var/log/syslog | tail -20 || echo "no syslog"
cat /var/log/daemon.log 2>/dev/null | grep -i "uvicorn\|openvpn\|error" | tail -20 || echo "no daemon.log"
