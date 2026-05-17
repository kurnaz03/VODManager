#!/bin/bash
# Step 1: set test password
/var/www/vod-manager/venv/bin/python3 /tmp/setpw2.py

# Create login json with new password
echo '{"username": "admin", "password": "TestPass123!"}' > /tmp/login_test.json

# Step 2: Login and get token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login -d @/tmp/login_test.json -H 'Content-Type: application/json' | /var/www/vod-manager/venv/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token", "ERROR:"+str(d)))')
echo "Token: ${TOKEN:0:50}..."

# Step 3: Call now-playing endpoint
echo "=== NOW PLAYING ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/playlists/now-playing

echo ""
echo "=== TEMPLATES ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/playlists/info-screen/templates

# Step 4: Restore original password
/var/www/vod-manager/venv/bin/python3 /tmp/restorepw.py
echo "Password restored."
