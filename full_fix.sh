#!/bin/bash
# Complete fix: Reset vod_user password to production value and fix admin password

DB_PASS="V0dM4n4g3r_Pr0d_2024_xK9mZ"

echo "=== STEP 1: Reset vod_user PostgreSQL password ==="
sudo -u postgres psql -c "ALTER USER vod_user WITH PASSWORD '${DB_PASS}';" && echo "Password set: OK"

echo ""
echo "=== STEP 2: Test DB connection ==="
PGPASSWORD=${DB_PASS} psql -U vod_user -d vod_manager -h 127.0.0.1 -c "SELECT 1 as test;" 2>&1

echo ""
echo "=== STEP 3: Fix admin user password (re-hash with argon2) ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from app.core.security import hash_password, verify_password

db = SessionLocal()
try:
    # Re-hash admin password  
    admin = db.query(User).filter(User.username == 'admin').first()
    if admin:
        new_hash = hash_password('admin123')
        admin.password_hash = new_hash
        db.commit()
        print('admin password reset to: admin123')
        
        # Verify it works
        ok = verify_password('admin123', new_hash)
        print('Verify:', ok)
    
    # Also fix gokhan
    gokhan = db.query(User).filter(User.username == 'gokhan').first()
    if gokhan:
        gokhan.password_hash = hash_password('admin123')
        db.commit()
        print('gokhan password reset to: admin123')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== STEP 4: Kill old uvicorn ==="
pkill -f uvicorn 2>/dev/null
sleep 2

echo ""
echo "=== STEP 5: Start uvicorn ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /tmp/uvicorn_prod.log 2>&1 &
echo "Uvicorn started PID: $!"

sleep 6

echo ""
echo "=== STEP 6: Test health ==="
curl -s http://127.0.0.1:8000/health && echo " <- health"

echo ""
echo "=== STEP 7: Test login via service ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest
db = SessionLocal()
try:
    req = LoginRequest(username='admin', password='admin123')
    result = service.login(db, req)
    print('LOGIN SUCCESS')
    print('Token:', result.access_token[:40], '...')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== STEP 8: Test VPN client create ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
from app.modules.openvpn.schemas import VpnClientCreate
db = SessionLocal()
try:
    # Delete test client if exists
    existing = db.query(__import__('app.modules.openvpn.models', fromlist=['VpnClient']).VpnClient).filter_by(name='testclient02').first()
    if existing:
        db.delete(existing)
        db.commit()
    
    data = VpnClientCreate(name='testclient02', description='Final test')
    result = vpn_service.create_client(db, data, user_id=1)
    print('VPN client created:', result.name, '| ID:', result.id, '| active:', result.is_active)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== UVICORN LOG ==="
tail -20 /tmp/uvicorn_prod.log 2>/dev/null
