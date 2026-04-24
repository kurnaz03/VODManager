#!/bin/bash
# Test VPN client creation via HTTP API

cd /var/www/vod-manager/app/backend

echo "=== STEP 1: Get auth token ==="
TOKEN=$(/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest
db = SessionLocal()
req = LoginRequest(username='admin', password='admin123')
result = service.login(db, req)
print(result.access_token)
db.close()
")
echo "Token obtained: ${TOKEN:0:30}..."

echo ""
echo "=== STEP 2: Get VPN server config ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
db = SessionLocal()
try:
    config = vpn_service.get_server_config(db)
    print('Server IP:', config.server_ip)
    print('Easy RSA dir:', config.easy_rsa_dir)
    print('Clients dir:', config.clients_dir)
    print('CA cert:', config.ca_cert_path)
    print('CA exists:', __import__('os').path.exists(config.ca_cert_path))
    print('EasyRSA exists:', __import__('os').path.exists(config.easy_rsa_dir))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== STEP 3: Test VPN client creation ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
from app.modules.openvpn.schemas import VpnClientCreate
db = SessionLocal()
try:
    data = VpnClientCreate(name='testclient01', description='Test client')
    result = vpn_service.create_client(db, data, user_id=1)
    print('VPN client created:', result.name, '| ID:', result.id)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== STEP 4: List VPN clients ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.openvpn import service as vpn_service
db = SessionLocal()
try:
    clients = vpn_service.list_clients(db)
    print('Total clients:', len(clients))
    for c in clients:
        print(' -', c.name, '| active:', c.is_active)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"
