#!/bin/bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("access_token","NO_TOKEN"))')
echo "TOKEN: ${TOKEN:0:20}..."
RESULT=$(curl -s -X POST http://127.0.0.1:8000/api/v1/music/download-youtube -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}')
echo "DOWNLOAD: $RESULT"
sleep 5
journalctl -u vod-manager-worker -n 5 --no-pager
journalctl -u vod-manager-api -n 5 --no-pager
