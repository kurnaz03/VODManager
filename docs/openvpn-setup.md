# OpenVPN Setup Guide for VOD Manager

## Prerequisites

Server: **62.210.92.252** (root access)

## 1. Install OpenVPN and easy-rsa

```bash
apt update && apt install -y openvpn easy-rsa
```

## 2. Initialize easy-rsa PKI

```bash
make-cadir /etc/openvpn/easy-rsa
cd /etc/openvpn/easy-rsa
```

Edit `vars` file to set your CA details (optional but recommended):
```bash
# /etc/openvpn/easy-rsa/vars
set_var EASYRSA_REQ_COUNTRY   "TR"
set_var EASYRSA_REQ_PROVINCE  "Istanbul"
set_var EASYRSA_REQ_CITY      "Istanbul"
set_var EASYRSA_REQ_ORG       "VODManager"
set_var EASYRSA_REQ_EMAIL     "admin@vodmanager.local"
set_var EASYRSA_REQ_OU        "VODManager VPN"
set_var EASYRSA_CA_EXPIRE     3650
set_var EASYRSA_CERT_EXPIRE   825
```

## 3. Build CA

```bash
cd /etc/openvpn/easy-rsa
./easyrsa init-pki
./easyrsa build-ca nopass
```

## 4. Build Server Certificate

```bash
./easyrsa build-server-full server nopass
```

## 5. Generate DH Parameters

```bash
./easyrsa gen-dh
```

## 6. Generate TLS Auth Key

```bash
openvpn --genkey secret /etc/openvpn/ta.key
```

## 7. Create Clients Directory

```bash
mkdir -p /etc/openvpn/clients
chmod 750 /etc/openvpn/clients
```

## 8. Server Configuration

Create `/etc/openvpn/server.conf`:

```conf
port 1194
proto udp
dev tun

ca   /etc/openvpn/easy-rsa/pki/ca.crt
cert /etc/openvpn/easy-rsa/pki/issued/server.crt
key  /etc/openvpn/easy-rsa/pki/private/server.key
dh   /etc/openvpn/easy-rsa/pki/dh.pem

tls-auth /etc/openvpn/ta.key 0
key-direction 0

server 10.8.0.0 255.255.255.0
ifconfig-pool-persist /var/log/openvpn/ipp.txt

push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"
push "dhcp-option DNS 8.8.4.4"

keepalive 10 120
cipher AES-256-GCM
auth SHA256

user nobody
group nogroup
persist-key
persist-tun

status /var/log/openvpn/openvpn-status.log
log-append /var/log/openvpn/openvpn.log
verb 3

crl-verify /etc/openvpn/easy-rsa/pki/crl.pem
```

## 9. Enable IP Forwarding

```bash
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p
```

## 10. Configure Firewall (UFW)

```bash
# Allow OpenVPN port
ufw allow 1194/udp

# Enable NAT - add to /etc/ufw/before.rules (before *filter line):
# *nat
# :POSTROUTING ACCEPT [0:0]
# -A POSTROUTING -s 10.8.0.0/8 -o eth0 -j MASQUERADE
# COMMIT

ufw reload
```

## 11. Start OpenVPN

```bash
mkdir -p /var/log/openvpn
systemctl enable openvpn@server
systemctl start openvpn@server
systemctl status openvpn@server
```

## 12. Generate CRL (required before first client)

```bash
cd /etc/openvpn/easy-rsa
./easyrsa gen-crl
```

## 13. Verify Default Paths

The VOD Manager API uses these default paths (configurable in Server Config panel):

| Setting         | Default Path                                          |
|----------------|-------------------------------------------------------|
| easy-rsa dir   | `/etc/openvpn/easy-rsa`                               |
| clients dir    | `/etc/openvpn/clients`                                |
| CA cert        | `/etc/openvpn/easy-rsa/pki/ca.crt`                   |
| Server cert    | `/etc/openvpn/easy-rsa/pki/issued/server.crt`        |
| Server key     | `/etc/openvpn/easy-rsa/pki/private/server.key`       |
| DH params      | `/etc/openvpn/easy-rsa/pki/dh.pem`                   |
| TA key         | `/etc/openvpn/ta.key`                                 |

## 14. Permissions

Ensure the app user (usually `www-data`) can read the PKI files:

```bash
chown -R root:www-data /etc/openvpn/easy-rsa/pki
chmod -R 750 /etc/openvpn/easy-rsa/pki
chmod 640 /etc/openvpn/easy-rsa/pki/private/*.key
chown root:www-data /etc/openvpn/ta.key
chmod 640 /etc/openvpn/ta.key
```

## 15. Client Usage

1. Open VOD Manager → **VPN Istemcileri**
2. Click **Yeni Istemci Olustur**, enter a name (e.g. `laptop-ali`)
3. Click **.ovpn Indir** to download the config file
4. Import into **OpenVPN Connect** (desktop/mobile) or any OpenVPN client
5. Connect to `62.210.92.252:1194`

## Troubleshooting

```bash
# Check OpenVPN server status
systemctl status openvpn@server

# View logs
journalctl -u openvpn@server -f
tail -f /var/log/openvpn/openvpn.log

# Check tun interface
ip addr show tun0

# Test easy-rsa manually
cd /etc/openvpn/easy-rsa
EASYRSA_BATCH=1 ./easyrsa build-client-full testclient nopass
```
