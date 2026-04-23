with open('/etc/nginx/sites-enabled/vod-manager', 'r') as f:
    content = f.read()

proxy_block = (
    "\n"
    "    location /hls-proxy/ {\n"
    "        proxy_pass http://127.0.0.1:8000/hls-proxy/;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Host " + "$" + "host;\n"
    "        proxy_set_header X-Real-IP " + "$" + "remote_addr;\n"
    "        proxy_buffering off;\n"
    "        proxy_read_timeout 60s;\n"
    "    }\n"
    "\n"
)

marker = '    location /hls/ {'
if '/hls-proxy/' not in content:
    content = content.replace(marker, proxy_block + marker)
else:
    # Already has hls-proxy but with wrong values — replace the broken block
    import re
    content = re.sub(
        r'location /hls-proxy/\s*\{[^}]*\}',
        proxy_block.strip(),
        content
    )

with open('/etc/nginx/sites-enabled/vod-manager', 'w') as f:
    f.write(content)

print('done')
