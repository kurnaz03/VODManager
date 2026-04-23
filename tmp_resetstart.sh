#!/bin/bash
# Argon2 ile yeni hash olustur ve admin sifresini guncelle
NEW_HASH=$(python3 -c "from argon2 import PasswordHasher; ph=PasswordHasher(); print(ph.hash('Admin1234'))")
echo "Yeni hash: $NEW_HASH"

PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager \
  -c "UPDATE users SET password_hash='$NEW_HASH' WHERE username='admin';"
echo "Sifre guncellendi"

# Login denemesi
cat > /tmp/login2.json << 'JSONEOF'
{"username":"admin","password":"Admin1234"}
JSONEOF

RESULT=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login2.json)
echo "Login result: $RESULT"

TOKEN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','NO_TOKEN'))" 2>/dev/null)
echo "TOKEN: $TOKEN"

if [ "$TOKEN" != "NO_TOKEN" ] && [ -n "$TOKEN" ]; then
  echo "--- Playlist 3 baslatiliyor ---"
  STARTRES=$(curl -s -X POST http://localhost:8000/api/v1/playlists/3/start \
    -H "Authorization: Bearer $TOKEN")
  echo "Start result: $STARTRES"
  
  # FFmpeg process dogrula
  sleep 3
  echo "--- FFmpeg kontrol ---"
  ps aux | grep ffmpeg | grep -v grep | head -5
fi
