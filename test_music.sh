#!/bin/bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

echo "TOKEN: $TOKEN"

# Test download
RESULT=$(curl -s -X POST http://127.0.0.1:8000/api/v1/music/download-youtube \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}')

echo "DOWNLOAD RESULT: $RESULT"

# Check worker logs
echo "--- WORKER LOGS ---"
journalctl -u vod-manager-worker -n 10 --no-pager 2>&1
