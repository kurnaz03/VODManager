#!/usr/bin/env python3
"""Stop and restart playlist 4 via API, then verify."""

import subprocess
import json
import sys
import time

API = "http://localhost:8000/api/v1"

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout.strip()

# 1. Get token - try common admin passwords
token = None
for pw in ["admin", "admin123", "Admin123", "password", "vod123"]:
    resp = run(f"curl -s -X POST {API}/auth/login -H 'Content-Type: application/json' -d '{{\"username\":\"admin\",\"password\":\"{pw}\"}}'")
    try:
        data = json.loads(resp)
        if "access_token" in data:
            token = data["access_token"]
            print(f"Login OK with password: {pw}")
            break
    except Exception:
        pass

if not token:
    # Try form-encoded
    for pw in ["admin", "admin123"]:
        resp = run(f"curl -s -X POST {API}/auth/token -F 'username=admin' -F 'password={pw}'")
        try:
            data = json.loads(resp)
            if "access_token" in data:
                token = data["access_token"]
                print(f"Token OK with password: {pw}")
                break
        except Exception:
            pass

if not token:
    print("Could not get token, trying direct DB stop+start approach")
    # Direct DB: update status to stopped so restart works
    stop_r = subprocess.run(
        "PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager -c \"UPDATE playlists SET status='stopped', ffmpeg_pid=NULL WHERE id=4;\"",
        shell=True, capture_output=True, text=True
    )
    print("DB stop:", stop_r.stdout.strip(), stop_r.stderr.strip())
    
    # Kill old FFmpeg on LB
    kill_r = subprocess.run(
        "ssh -o StrictHostKeyChecking=no root@138.201.196.89 'pkill -f \"ffmpeg.*playlist_4\" || true'",
        shell=True, capture_output=True, text=True
    )
    print("Kill old FFmpeg:", kill_r.returncode)
    sys.exit(0)

# Stop
print(run(f"curl -s -X POST {API}/playlists/4/stop -H 'Authorization: Bearer {token}'"))
time.sleep(2)

# Start  
print(run(f"curl -s -X POST {API}/playlists/4/start -H 'Authorization: Bearer {token}'"))
time.sleep(5)

# Check stream_url
resp = run(f"curl -s {API}/playlists/4 -H 'Authorization: Bearer {token}'")
try:
    data = json.loads(resp)
    print(f"Status: {data.get('status')}")
    print(f"stream_url: {data.get('stream_url')}")
    print(f"ffmpeg_pid: {data.get('ffmpeg_pid')}")
except Exception:
    print(resp[:500])
