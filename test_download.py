import json
import subprocess

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login', 
    '-H', 'Content-Type: application/json', 
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})], 
    capture_output=True, text=True)

token = json.loads(login.stdout)['access_token']
print(f'Token: {token[:30]}...')

# Get clients
clients = subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/openvpn/clients',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
print('Clients:', clients.stdout)

# Try download first client
try:
    client_list = json.loads(clients.stdout)
    if client_list:
        client_id = client_list[0]['id']
        print(f'Downloading client {client_id}...')
        
        download = subprocess.run(['curl', '-s', '-v', f'http://127.0.0.1:8000/api/v1/openvpn/clients/{client_id}/download',
            '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
        print('Download response (first 500 chars):', download.stdout[:500])
        print('Download stderr:', download.stderr[:500])
except Exception as e:
    print('Error:', e)
