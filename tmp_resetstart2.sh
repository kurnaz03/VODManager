#!/bin/bash
VENV=/var/www/vod-manager/venv/bin/python3

# Argon2 ile yeni hash olustur
NEW_HASH=$($VENV -c "from argon2 import PasswordHasher; ph=PasswordHasher(); print(ph.hash('Admin1234'))")
echo "Yeni hash: $NEW_HASH"

PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager \
  -c "UPDATE users SET password_hash='$NEW_HASH' WHERE username='admin';"
echo "Sifre guncellendi"

cat > /tmp/login3.json << 'JSONEOF'
{"username":"admin","password":"Admin1234"}
JSONEOF

RESULT=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login3.json)
echo "Login: $RESULT"

TOKEN=$($VENV -c "import sys,json; d=json.loads('$RESULT'); print(d.get('access_token','NO_TOKEN'))" 2>/dev/null)
# alternatif python json parse
TOKEN=$(echo "$RESULT" | $VENV -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','NO_TOKEN'))")
echo "TOKEN: $TOKEN"

if [ "$TOKEN" != "NO_TOKEN" ] && [ -n "$TOKEN" ]; then
  echo "--- Playlist 3 baslatiliyor ---"
  STARTRES=$(curl -s -X POST http://localhost:8000/api/v1/playlists/3/start \
    -H "Authorization: Bearer $TOKEN")
  echo "Start: $STARTRES"

  sleep 4
  echo "--- FFmpeg -re kontrol ---"
  ps aux | grep ffmpeg | grep -v grep | grep '\-re' | head -3
  echo "--- FFmpeg log speed ---"
  tail -5 /var/www/vod-manager/shared/hls/3/ffmpeg.log 2>/dev/null || echo "log bulunamadi"
fi
