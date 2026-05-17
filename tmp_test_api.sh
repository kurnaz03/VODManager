#!/bin/bash
cd /var/www/vod-manager/app
source venv/bin/activate
export PYTHONPATH=/var/www/vod-manager/app

TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"username":"admin","password":"Kia2014x"}' http://127.0.0.1:8000/api/v1/auth/login | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
echo "Token acquired: ${#TOKEN} chars"
RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/playlists/now-playing)
echo "API result: $RESULT"
