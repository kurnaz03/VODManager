import json
import subprocess

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})],
    capture_output=True, text=True)
print('Login:', login.stdout[:200])
data = json.loads(login.stdout)
if 'access_token' not in data:
    print('Login failed')
    exit(1)
token = data['access_token']

# Download ovpn
resp = subprocess.run(['curl', '-s', f'http://127.0.0.1:8000/api/v1/openvpn/clients/8/download',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)

# Save and show
with open('/tmp/client.ovpn', 'w') as f:
    f.write(resp.stdout)

# Check tls-crypt section
lines = resp.stdout.split('\n')
in_crypt = False
for i, line in enumerate(lines):
    if 'tls-crypt' in line or 'tls-auth' in line:
        print(f'Line {i}: {line}')
        in_crypt = True
    elif in_crypt and ('---' in line or '</' in line):
        print(f'Line {i}: {line}')
        if '</' in line:
            in_crypt = False

# Compare ta.key
import hashlib
# Extract key from ovpn
ovpn_key_lines = []
capture = False
for line in lines:
    if '<tls-crypt>' in line:
        capture = True
        continue
    if '</tls-crypt>' in line:
        capture = False
        continue
    if capture:
        ovpn_key_lines.append(line)

ovpn_key = '\n'.join(ovpn_key_lines).strip()
ovpn_hash = hashlib.md5(ovpn_key.encode()).hexdigest()
print(f'\nOVPN tls-crypt key hash: {ovpn_hash}')

# Server ta.key
with open('/etc/openvpn/clients/ta.key', 'r') as f:
    server_key = f.read().strip()
server_hash = hashlib.md5(server_key.encode()).hexdigest()
print(f'Server ta.key hash: {server_hash}')
print(f'Keys match: {ovpn_hash == server_hash}')
