# coding: utf-8
"""Test PUT /iptv-users/{id} endpoint"""
import subprocess, json, sys

# Get token
r = subprocess.run(
    ['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
     '-H', 'Content-Type: application/json',
     '-d', '{"username":"admin","password":"admin"}'],
    capture_output=True, text=True
)
print('Login response:', r.stdout[:200])
token_data = json.loads(r.stdout)
token = token_data.get('access_token', '')
print('Token obtained:', bool(token))

# Get users
r2 = subprocess.run(
    ['curl', '-s', '-H', 'Authorization: Bearer ' + token,
     'http://127.0.0.1:8000/api/v1/iptv-users'],
    capture_output=True, text=True
)
users = json.loads(r2.stdout)
if not users:
    print('No users found')
    sys.exit(1)

user = users[0]
uid = user['id']
print('Testing PUT for user id=%d username=%s' % (uid, user['username']))

# Try PUT update
import time
payload = {
    'username': user['username'],
    'password': user['password'],
    'owner': user['owner'],
    'max_connections': user['max_connections'],
    'is_trial': user['is_trial'],
    'is_enabled': user['is_enabled'],
    'expiry_date': user['expiry_date'],
    'admin_notes': 'debug test ' + str(int(time.time())),
    'reseller_notes': user['reseller_notes'],
    'forced_connection': user['forced_connection'],
    'is_restreamer': user['is_restreamer'],
    'forced_country': user['forced_country'],
    'isp_lock_info': user['isp_lock_info'],
    'access_hls': user['access_hls'],
    'access_mpegts': user['access_mpegts'],
    'access_rtmp': user['access_rtmp'],
    'allowed_ips': user['allowed_ips'],
    'allowed_user_agents': user['allowed_user_agents'],
    'bouquet_ids': [b['id'] for b in user['bouquets']],
}

r3 = subprocess.run(
    ['curl', '-s', '-v', '-X', 'PUT',
     'http://127.0.0.1:8000/api/v1/iptv-users/' + str(uid),
     '-H', 'Authorization: Bearer ' + token,
     '-H', 'Content-Type: application/json',
     '-d', json.dumps(payload)],
    capture_output=True, text=True
)
print('PUT stdout:', r3.stdout[:1500])
print('PUT stderr (headers):', r3.stderr[:500])
