#!/bin/bash
# DB'den admin kullanicisini bul
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager -c "SELECT id, username, status FROM users LIMIT 5;"

# Login denemesi - JSON dosyasi kullan
cat > /tmp/login_payload.json << 'JSONEOF'
{"username":"admin","password":"admin"}
JSONEOF

echo "--- Login denemesi ---"
RESULT=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login_payload.json)
echo "$RESULT"

TOKEN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','NO_TOKEN'))" 2>/dev/null)
echo "TOKEN: $TOKEN"

if [ "$TOKEN" != "NO_TOKEN" ] && [ -n "$TOKEN" ]; then
  echo "--- Playlist 3 baslatiliyor ---"
  curl -s -X POST http://localhost:8000/api/v1/playlists/3/start \
    -H "Authorization: Bearer $TOKEN"
fi
