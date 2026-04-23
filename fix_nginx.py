import re

with open('/etc/nginx/sites-available/vod-manager', 'r') as f:
    content = f.read()

old = """    location /hls/ {
        proxy_pass http://127.0.0.1:8000/hls/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }"""

new = """    location /hls/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }"""

if old in content:
    content = content.replace(old, new)
    with open('/etc/nginx/sites-available/vod-manager', 'w') as f:
        f.write(content)
    print('REPLACED OK')
else:
    print('NOT FOUND - showing hls section:')
    idx = content.find('location /hls/')
    print(repr(content[idx:idx+300]))
