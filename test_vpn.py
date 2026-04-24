import json
import subprocess

# Create JSON files
with open('/tmp/login.json', 'w') as f:
    json.dump({'username': 'admin', 'password': 'admin'}, f)

with open('/tmp/vpn_client.json', 'w') as f:
    json.dump({'name': 'testclient', 'description': 'test'}, f)

# Login
result = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login', '-H', 'Content-Type: application/json', '-d', '@/tmp/login.json'], capture_output=True, text=True)
print('Login response:', result.stdout)

try:
    data = json.loads(result.stdout)
    token = data['access_token']
    print(f'Token: {token[:30]}...')
    
    # Create VPN client
    result2 = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/openvpn/clients', '-H', 'Content-Type: application/json', '-H', f'Authorization: Bearer {token}', '-d', '@/tmp/vpn_client.json'], capture_output=True, text=True)
    print('VPN create response:', result2.stdout)
except Exception as e:
    print('Error:', e)
