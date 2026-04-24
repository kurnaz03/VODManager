#!/bin/bash
# Test VPN create with verbose error

VENV_PY=/var/www/vod-manager/venv/bin/python3

$VENV_PY << 'EOF'
import urllib.request, json

BASE = 'http://127.0.0.1:8000'

# Login
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(BASE + '/api/v1/auth/login', data=data, method='POST',
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    token = json.loads(resp.read())['access_token']

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Create VPN client
data = json.dumps({'name': 'newclient777', 'description': 'test'}).encode()
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        client = json.loads(resp.read())
        print(f'SUCCESS: name={client["name"]} id={client["id"]}')
except urllib.error.HTTPError as e:
    print(f'HTTP {e.code}')
    err = e.read().decode()
    # Parse JSON detail if available
    try:
        detail = json.loads(err)
        print('Detail:', json.dumps(detail, indent=2))
    except:
        print('Raw:', err[:500])
EOF
