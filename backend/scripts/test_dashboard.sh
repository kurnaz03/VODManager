#!/bin/bash
RESP=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
if [ -z "$TOKEN" ]; then
  echo "Login failed: $RESP"
  exit 1
fi
curl -s http://localhost:8000/api/v1/admin/dashboard -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
