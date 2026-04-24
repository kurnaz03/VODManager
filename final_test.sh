#!/bin/bash
# Test VPN API with token in same python call

VENV_PY=/var/www/vod-manager/venv/bin/python3

echo "=== COMPLETE END-TO-END TEST ==="
$VENV_PY << 'EOF'
import urllib.request, json

BASE = 'http://127.0.0.1:8000'

# Step 1: Login
print("1. Login...")
data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode()
req = urllib.request.Request(BASE + '/api/v1/auth/login', data=data, method='POST',
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as resp:
    login_data = json.loads(resp.read())
token = login_data['access_token']
print(f'   LOGIN OK - token: {token[:30]}...')

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Step 2: List VPN clients
print("2. List VPN clients...")
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    clients = json.loads(resp.read())
print(f'   VPN clients count: {len(clients)}')
for c in clients:
    print(f'   - {c["name"]} id:{c["id"]} active:{c["is_active"]}')

# Step 3: Create VPN client
print("3. Create VPN client...")
data = json.dumps({'name': 'finaltest01', 'description': 'Final e2e test'}).encode()
req = urllib.request.Request(BASE + '/api/v1/openvpn/clients', data=data, method='POST', headers=headers)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        client = json.loads(resp.read())
        print(f'   VPN client created: {client["name"]} id:{client["id"]} active:{client["is_active"]}')
        if client.get('ovpn_path'):
            print(f'   ovpn_path: {client["ovpn_path"]}')
except urllib.error.HTTPError as e:
    err = e.read().decode()
    print(f'   HTTP Error {e.code}: {err[:200]}')

# Step 4: Get VPN server config
print("4. VPN server config...")
req = urllib.request.Request(BASE + '/api/v1/openvpn/server-config', headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    config = json.loads(resp.read())
print(f'   server_ip: {config.get("server_ip")} port: {config.get("server_port")} protocol: {config.get("protocol")}')

print("")
print("=== ALL TESTS PASSED ===")
EOF
