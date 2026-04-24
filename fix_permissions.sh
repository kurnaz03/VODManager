#!/bin/bash
# Complete permission fix for EasyRSA

echo "=== Current permissions ==="
stat /etc/openvpn/
stat /etc/openvpn/easy-rsa/

echo ""
echo "=== Add www-data to openvpn group ==="
usermod -aG openvpn www-data
id www-data

echo ""
echo "=== Set correct permissions on /etc/openvpn/ ==="
chown root:openvpn /etc/openvpn/
chmod 750 /etc/openvpn/

chown root:openvpn /etc/openvpn/easy-rsa/
chmod 770 /etc/openvpn/easy-rsa/

# Also fix the easyrsa script itself
chmod 750 /etc/openvpn/easy-rsa/easyrsa 2>/dev/null || true
/usr/share/easy-rsa/easyrsa --version 2>/dev/null && echo "easy-rsa version OK"

echo ""
echo "=== Restart uvicorn (to get new group membership) ==="
pkill -f uvicorn 2>/dev/null
sleep 2

cd /var/www/vod-manager/app/backend
# Run as root initially to avoid group update issue
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /tmp/uvicorn_root.log 2>&1 &
echo "Uvicorn PID: $!"
sleep 5

echo ""
echo "=== Health check ==="
curl -s http://127.0.0.1:8000/health

echo ""
echo "=== Permissions now ==="
sudo -u www-data ls /etc/openvpn/ 2>&1
sudo -u www-data ls /etc/openvpn/easy-rsa/ 2>&1

echo ""
echo "=== Test www-data EasyRSA access (with newgrp) ==="
# Test if process with openvpn group can access
su -s /bin/bash www-data -c "groups && ls /etc/openvpn/easy-rsa/ 2>&1 | head -5"
