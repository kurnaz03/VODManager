#!/bin/bash
# Debug VPN client 500 error

VENV_PY=/var/www/vod-manager/venv/bin/python3

echo "=== VPN Create Debug ==="
$VENV_PY << 'EOF'
import sys, traceback
sys.path.insert(0, '/var/www/vod-manager/app/backend')

from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
from app.modules.openvpn.schemas import VpnClientCreate
from fastapi import HTTPException

db = SessionLocal()
try:
    data = VpnClientCreate(name='debugclient01', description='Debug test')
    result = vpn_service.create_client(db, data, user_id=1)
    print('SUCCESS:', result.name)
except HTTPException as e:
    print('HTTPException:', e.status_code, '-', e.detail)
except Exception as e:
    traceback.print_exc()
finally:
    db.close()
EOF

echo ""
echo "=== EasyRSA check ==="
ls -la /etc/openvpn/easy-rsa/
echo ""
ls -la /etc/openvpn/easy-rsa/pki/ 2>/dev/null || echo "No pki dir"
echo ""
which easyrsa
ls /etc/openvpn/easy-rsa/easyrsa 2>/dev/null || echo "easyrsa not found"

echo ""
echo "=== Direct easyrsa test ==="
cd /etc/openvpn/easy-rsa
EASYRSA_BATCH=1 ./easyrsa --help 2>&1 | head -5
