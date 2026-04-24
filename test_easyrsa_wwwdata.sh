#!/bin/bash
# Test EasyRSA build-client-full as www-data directly

echo "=== EasyRSA client build as www-data ==="
su -s /bin/bash www-data -c "
  cd /etc/openvpn/easy-rsa
  export EASYRSA_BATCH=1
  ./easyrsa build-client-full wwdatatest01 nopass 2>&1
  echo 'EXIT CODE:' \$?
"

echo ""
echo "=== Check if cert was created ==="
ls -la /etc/openvpn/easy-rsa/pki/issued/ | grep wwdata
ls -la /etc/openvpn/easy-rsa/pki/private/ | grep wwdata
