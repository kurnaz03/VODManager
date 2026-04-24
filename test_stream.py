import json
import subprocess

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})],
    capture_output=True, text=True)
token = json.loads(login.stdout)['access_token']

# Get IPTV users
users = subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/iptv-users',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
user_list = json.loads(users.stdout)
print('IPTV Users:')
for u in user_list:
    print(f"  {u.get('username')}/{u.get('password')} active={u.get('is_active')}")

# Get TV channels
tv = subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/tv/channels',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
tv_list = json.loads(tv.stdout)
print(f'\nTV Channels ({len(tv_list)}):')
for ch in tv_list:
    print(f"  id={ch['id']} name={ch['name']} url={ch.get('stream_url','N/A')[:80]}")

# Test M3U with first user
if user_list:
    u = user_list[0]
    m3u_url = f"http://127.0.0.1:8000/get.php?username={u['username']}&password={u['password']}&type=m3u_plus"
    m3u = subprocess.run(['curl', '-s', m3u_url], capture_output=True, text=True)
    print(f'\nM3U output (first 1000 chars):')
    print(m3u.stdout[:1000])

    # Test live stream for first TV channel
    if tv_list:
        ch_id = tv_list[0]['id']
        live_url = f"http://127.0.0.1:8000/live/tv/{u['username']}/{u['password']}/{ch_id}.ts"
        print(f'\nTesting TV stream: {live_url}')
        live = subprocess.run(['curl', '-s', '-w', '\nHTTP:%{http_code}', '-o', '/dev/null', live_url],
            capture_output=True, text=True, timeout=10)
        print(f'Response: {live.stdout}')
