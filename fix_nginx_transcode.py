#!/usr/bin/env python3
"""Fix /transcode/ location in main server nginx config."""

nginx_path = "/etc/nginx/sites-available/vod-manager"

with open(nginx_path) as f:
    content = f.read()

# Remove the broken transcode block
import re
broken = re.sub(
    r"\n    location /transcode/ \{[^}]*\}\n",
    "\n",
    content,
    flags=re.DOTALL
)

transcode_block = """
    location /transcode/ {
        alias /var/www/vod-manager/shared/transcode/;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    location / {"""

result = broken.replace("    location / {", transcode_block, 1)

with open(nginx_path, "w") as f:
    f.write(result)

print("OK: /transcode/ location fixed")
