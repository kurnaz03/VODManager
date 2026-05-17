#!/bin/bash
TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' -d @/tmp/login.json http://127.0.0.1:8000/api/v1/auth/login | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",d))')
echo "TOK: ${TOKEN:0:30}"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/playlists/now-playing
