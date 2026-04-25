import json
import subprocess

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})],
    capture_output=True, text=True)
token = json.loads(login.stdout)['access_token']

# Download ovpn for client 8
resp = subprocess.run(['curl', '-s', f'http://127.0.0.1:8000/api/v1/openvpn/clients/8/download',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
print(resp.stdout)
