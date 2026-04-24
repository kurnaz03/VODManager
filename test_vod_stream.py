import json
import subprocess

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})],
    capture_output=True, text=True)
token = json.loads(login.stdout)['access_token']

# Get IPTV users
users = json.loads(subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/iptv-users',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True).stdout)
u = users[0]
print(f'User: {u["username"]}/{u["password"]}')

# Get M3U
m3u_url = f'http://127.0.0.1:8080/get.php?username={u["username"]}&password={u["password"]}&type=m3u_plus'
m3u = subprocess.run(['curl', '-s', m3u_url], capture_output=True, text=True)
print(f'\nFull M3U:\n{m3u.stdout}')

# Get playlists (VOD channels)
playlists = subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/playlists',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True)
print(f'\nPlaylists: {playlists.stdout[:500]}')

# Check FFmpeg running
import os
ffmpeg = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
for line in ffmpeg.stdout.split('\n'):
    if 'ffmpeg' in line.lower() and 'grep' not in line:
        print(f'\nFFmpeg: {line}')

# Check HLS files
hls = subprocess.run(['ls', '-la', '/var/www/vod-manager/streams/'], capture_output=True, text=True)
print(f'\nHLS dir: {hls.stdout[:500]}')

# Test /live/ endpoint for VOD channel
for line in m3u.stdout.split('\n'):
    if '/live/' in line and '/live/tv/' not in line:
        url = line.strip()
        local_url = url.replace('http://62.210.92.252:8080', 'http://127.0.0.1:8080')
        print(f'\nTesting VOD live URL: {local_url}')
        resp = subprocess.run(['curl', '-s', '-w', '\nHTTP:%{http_code}', '-o', '/tmp/vod_test.txt', local_url],
            capture_output=True, text=True, timeout=10)
        print(f'Result: {resp.stdout}')
        with open('/tmp/vod_test.txt', 'r') as f:
            print(f'Content: {f.read()[:500]}')
        break
