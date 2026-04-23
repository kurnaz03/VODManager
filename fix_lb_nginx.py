#!/usr/bin/env python3
"""Add /hls/ location to LB server nginx config (handles tab-indented default config)."""

nginx_path = "/etc/nginx/sites-available/default"

with open(nginx_path) as f:
    content = f.read()

if "location /hls/" in content:
    print("hls location already exists")
else:
    hls_block = """\tlocation /hls/ {
\t\talias /var/www/vod-manager/shared/hls/;
\t\tadd_header Cache-Control no-cache;
\t\tadd_header Access-Control-Allow-Origin *;
\t\tadd_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
\t\tadd_header Access-Control-Allow-Headers "*";
\t\ttypes {
\t\t\tapplication/vnd.apple.mpegurl m3u8;
\t\t\tvideo/mp2t ts;
\t\t}
\t}

\tlocation / {"""

    # The actual file uses tab-indented "	location / {"
    result = content.replace("\tlocation / {", hls_block, 1)
    with open(nginx_path, "w") as f:
        f.write(result)
    print("OK: /hls/ location added to LB nginx")
