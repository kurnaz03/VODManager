#!/bin/bash
# Direct EasyRSA test as www-data user and service layer test

echo "=== Test 1: EasyRSA as root (reference) ==="
cd /etc/openvpn/easy-rsa
EASYRSA_BATCH=1 ./easyrsa build-client-full testdirect99 nopass 2>&1 | head -5
echo "exit: $?"

echo ""
echo "=== Test 2: EasyRSA as www-data ==="
su -s /bin/bash www-data -c "cd /etc/openvpn/easy-rsa && EASYRSA_BATCH=1 ./easyrsa build-client-full testwwwdata01 nopass 2>&1 | head -10"
echo "exit: $?"

echo ""
echo "=== Test 3: Direct Python service test (as www-data) ==="
su -s /bin/bash www-data -c "
  cd /var/www/vod-manager/app/backend
  PYTHONPATH=/var/www/vod-manager/app/backend /var/www/vod-manager/venv/bin/python3 << 'PYEOF'
import sys, traceback
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
from app.modules.openvpn.schemas import VpnClientCreate
from fastapi import HTTPException

db = SessionLocal()
try:
    data = VpnClientCreate(name='pythonwww01', description='test')
    result = vpn_service.create_client(db, data, user_id=1)
    print('SUCCESS:', result.name)
except HTTPException as e:
    print(f'HTTPException {e.status_code}: {e.detail}')
except Exception as e:
    traceback.print_exc()
finally:
    db.close()
PYEOF
"

echo ""
echo "=== Test 4: Direct Python service test (as root) ==="
cd /var/www/vod-manager/app/backend
PYTHONPATH=/var/www/vod-manager/app/backend /var/www/vod-manager/venv/bin/python3 << 'PYEOF'
import sys, traceback
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
from app.modules.openvpn.schemas import VpnClientCreate
from fastapi import HTTPException

db = SessionLocal()
try:
    data = VpnClientCreate(name='pythonroot01', description='test')
    result = vpn_service.create_client(db, data, user_id=1)
    print('SUCCESS:', result.name)
except HTTPException as e:
    print(f'HTTPException {e.status_code}: {e.detail[:300]}')
except Exception as e:
    traceback.print_exc()
finally:
    db.close()
PYEOF
