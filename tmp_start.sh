#!/bin/bash
# Auth token al
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin&password=admin' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  # OAuth2 form denemesi
  TOKEN=$(curl -s http://localhost:8000/api/v1/auth/token -X POST \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'username=admin&password=admin' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)
fi

echo "TOKEN=$TOKEN"

if [ -n "$TOKEN" ]; then
  curl -s -X POST http://localhost:8000/api/v1/playlists/3/start \
    -H "Authorization: Bearer $TOKEN"
else
  echo "Token alinamadi, endpoint listesi:"
  curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); [print(p) for p in d.get('paths',{}) if 'auth' in p or 'login' in p or 'token' in p]"
fi
