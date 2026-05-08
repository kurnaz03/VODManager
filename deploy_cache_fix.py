#!/usr/bin/env python3
"""Deploy script for cache fix"""

import subprocess
import sys

def ssh_command(host, password, cmd):
    """Run SSH command via plink"""
    full_cmd = f"plink.exe -no-antispoof -batch -pw {password} root@{host} '{cmd}'"
    result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
    return result

# Nginx config with cache-control headers
NGINX_CONFIG = '''server {
    listen 80;
    server_name YOUR_SERVER_IP;

    root /var/www/vod-manager/app/frontend-dist;
    index index.html;

    client_max_body_size 2G;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        client_max_body_size 2G;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }

    location /player_api.php {
        proxy_pass http://127.0.0.1:8000/player_api.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }

    location /panel_api.php {
        proxy_pass http://127.0.0.1:8000/panel_api.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }

    location /get.php {
        proxy_pass http://127.0.0.1:8000/get.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location /uploads/ {
        alias /var/www/vod-manager/shared/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location /streams/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control "no-cache";
        add_header Access-Control-Allow-Origin "*";
        types {
            application/vnd.apple.mpegurl m3u8;
            video/MP2T ts;
        }
    }

    location /hls/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }

    location /transcode/ {
        alias /var/www/vod-manager/shared/transcode/;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
}

# M3U Plus / Xtream stream port
server {
    listen 8080;
    server_name YOUR_SERVER_IP;

    client_max_body_size 2G;

    location /get.php {
        proxy_pass http://127.0.0.1:8000/get.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location /player_api.php {
        proxy_pass http://127.0.0.1:8000/player_api.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }

    location /panel_api.php {
        proxy_pass http://127.0.0.1:8000/panel_api.php;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }

    location /live/ {
        proxy_pass http://127.0.0.1:8000/live/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_buffering off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        proxy_hide_header Cache-Control;
        proxy_hide_header Pragma;
        proxy_hide_header Expires;
    }

    location /movie/ {
        proxy_pass http://127.0.0.1:8000/movie/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 600s;
        proxy_buffering off;
    }

    location /series/ {
        proxy_pass http://127.0.0.1:8000/series/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 600s;
        proxy_buffering off;
    }

    location /hls/ {
        alias /var/www/vod-manager/shared/hls/;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }

    location /hls-proxy/ {
        proxy_pass http://127.0.0.1:8000/hls-proxy/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
        proxy_buffering off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        proxy_hide_header Cache-Control;
        proxy_hide_header Pragma;
        proxy_hide_header Expires;
    }
}
'''

def deploy_main_server():
    host = "62.210.92.252"
    password = "Kia2014x"
    
    print("=== Deploying to Main Server ===")
    
    # Backup nginx config
    print("[1/4] Creating backup...")
    r = ssh_command(host, password, "cp /etc/nginx/sites-enabled/vod-manager /etc/nginx/sites-enabled/vod-manager.backup")
    print(f"Backup result: {r.returncode}")
    
    # Write new nginx config using base64 to avoid escaping issues
    print("[2/4] Writing new nginx config...")
    import base64
    config_b64 = base64.b64encode(NGINX_CONFIG.encode()).decode()
    r = ssh_command(host, password, f"echo '{config_b64}' | base64 -d > /etc/nginx/sites-enabled/vod-manager")
    print(f"Config write result: {r.returncode}")
    if r.stderr:
        print(f"Stderr: {r.stderr}")
    
    # Test nginx config
    print("[3/4] Testing nginx config...")
    r = ssh_command(host, password, "nginx -t")
    print(f"Nginx test result: {r.returncode}")
    print(f"Stdout: {r.stdout}")
    if r.stderr:
        print(f"Stderr: {r.stderr}")
    
    # Reload nginx
    if r.returncode == 0:
        print("[4/4] Reloading nginx...")
        r = ssh_command(host, password, "systemctl reload nginx")
        print(f"Nginx reload result: {r.returncode}")
        if r.stderr:
            print(f"Stderr: {r.stderr}")
    else:
        print("[4/4] Skipping nginx reload due to config test failure")
    
    print("\n=== Deploying Python code ===")
    
    # Copy local router.py to server
    print("[1/2] Copying router.py...")
    local_file = r"C:\Users\kurna\Projects\VODManager\backend\app\modules\stream\router.py"
    remote_path = "/var/www/vod-manager/app/backend/app/modules/stream/router.py"
    
    # Use pscp for file copy
    pscp_cmd = f"pscp.exe -pw {password} '{local_file}' root@{host}:{remote_path}"
    r = subprocess.run(pscp_cmd, shell=True, capture_output=True, text=True)
    print(f"File copy result: {r.returncode}")
    if r.stderr:
        print(f"Stderr: {r.stderr}")
    
    # Restart backend
    print("[2/2] Restarting backend...")
    r = ssh_command(host, password, "systemctl restart vod-manager")
    print(f"Backend restart result: {r.returncode}")
    if r.stderr:
        print(f"Stderr: {r.stderr}")
    
    # Check status
    r = ssh_command(host, password, "systemctl is-active vod-manager")
    print(f"Backend status: {r.stdout.strip()}")
    
    print("\n=== Main Server Deployment Complete ===")

if __name__ == "__main__":
    deploy_main_server()
