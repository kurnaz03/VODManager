import json
import subprocess
import time

# Login
login = subprocess.run(['curl', '-s', '-X', 'POST', 'http://127.0.0.1:8000/api/v1/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({'username': 'admin', 'password': 'admin123'})],
    capture_output=True, text=True)
token = json.loads(login.stdout)['access_token']

# Get user and channel
users = json.loads(subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/iptv-users',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True).stdout)
channels = json.loads(subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/v1/tv/channels',
    '-H', f'Authorization: Bearer {token}'], capture_output=True, text=True).stdout)

if users and channels:
    u = users[0]
    ch = channels[0]
    print(f'User: {u["username"]}/{u["password"]}')
    print(f'Channel: {ch["name"]} stream_url: {ch["stream_url"]}')
    
    # Get fresh m3u8 via proxy
    m3u8_url = f'http://127.0.0.1:8080/live/tv/{u["username"]}/{u["password"]}/{ch["id"]}.ts'
    print(f'\nFetching fresh m3u8: {m3u8_url}')
    m3u8 = subprocess.run(['curl', '-s', m3u8_url], capture_output=True, text=True)
    print(f'M3U8 content:\n{m3u8.stdout[:500]}')
    
    # Extract first segment URL and test it
    for line in m3u8.stdout.split('\n'):
        if line.strip() and not line.startswith('#'):
            seg_url = line.strip()
            # Convert to local URL for testing
            local_seg = seg_url.replace(f'http://62.210.92.252:8080', 'http://127.0.0.1:8080')
            print(f'\nTesting segment: {local_seg}')
            seg = subprocess.run(['curl', '-s', '-w', '\nHTTP:%{http_code}', '-o', '/dev/null', local_seg], 
                capture_output=True, text=True, timeout=15)
            print(f'Result: {seg.stdout}')
            
            # Also test source directly
            source_url = ch['stream_url']
            from urllib.parse import urlparse
            parsed = urlparse(source_url)
            path_parts = parsed.path.rsplit('/', 1)
            base_path = path_parts[0] + '/' if len(path_parts) > 1 else '/'
            # Get segment name from the proxy URL
            seg_name = seg_url.split('/')[-1]
            direct_url = f'{parsed.scheme}://{parsed.netloc}{base_path}{seg_name}'
            print(f'\nDirect source URL: {direct_url}')
            direct = subprocess.run(['curl', '-s', '-w', '\nHTTP:%{http_code}', '-o', '/dev/null', direct_url],
                capture_output=True, text=True, timeout=15)
            print(f'Direct result: {direct.stdout}')
            break
