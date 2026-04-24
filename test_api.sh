#!/bin/bash
# Test login and VPN after DB fix

echo "=== TEST 1: Health check ==="
curl -s http://127.0.0.1:8000/health

echo ""
echo "=== TEST 2: Login test ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest
db = SessionLocal()
try:
    req = LoginRequest(username='admin', password='admin')
    result = service.login(db, req)
    print('Login OK:', type(result).__name__)
    print('Has access_token:', hasattr(result, 'access_token'))
except Exception as e:
    print('Login ERROR:', type(e).__name__, str(e)[:200])
finally:
    db.close()
"

echo ""
echo "=== TEST 3: Get admin user list ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
db = SessionLocal()
try:
    users = db.query(User).all()
    for u in users:
        print('User:', u.username, '| Status:', u.status)
except Exception as e:
    print('ERROR:', type(e).__name__, str(e)[:200])
finally:
    db.close()
"

echo ""
echo "=== TEST 4: VPN server config ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
db = SessionLocal()
try:
    config = vpn_service.get_server_config(db)
    print('VPN config:', config)
except Exception as e:
    print('VPN ERROR:', type(e).__name__, str(e)[:200])
finally:
    db.close()
"

echo ""
echo "=== TEST 5: HTTP API login test ==="
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','NO_TOKEN'))" 2>/dev/null)
echo "Token: ${TOKEN:0:50}..."

echo ""
echo "=== UVICORN LOG (last 30 lines) ==="
tail -30 /tmp/uvicorn.log 2>/dev/null || echo "No uvicorn log"
