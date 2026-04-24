#!/bin/bash
# Get full VPN error detail

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

# Try with a unique new name
import time
name = f'vpnclient_{int(time.time())}'
print(f'Testing with name: {name}')

data = json.dumps({'name': name, 'description': 'test'}).encode()
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        client = json.loads(resp.read())
        print(f'SUCCESS: {client["name"]} id:{client["id"]}')
except urllib.error.HTTPError as e:
    body = e.read().decode()
    try:
        detail = json.loads(body)
        print(f'HTTP {e.code}:')
        print(json.dumps(detail, indent=2, ensure_ascii=False))
    except:
        print(f'HTTP {e.code}: {body}')
EOF
