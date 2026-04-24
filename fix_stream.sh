#!/bin/bash
# fix_stream.sh — Stream sorunlarini duzelt
# Calistir: bash fix_stream.sh (sunucu uzerinde root olarak)
# Sorunlar:
#   1. TV kanal HLS proxy: /hls-proxy/ nginx'te eksikti
#   2. VOD kanal (lokal): stream_url /streams/ yoluydu (port 80), port 8080 /hls/ bekleniyordu
#   3. VOD kanal (LB): /hls-proxy/ nginx'te eksikti — segment proxy calismiyor
#   4. Port 8080 firewall'da eksikti

set -e
BACKEND_DIR="/var/www/vod-manager/app/backend"

echo "=== Stream Fix Basliyor ==="

# 1. Backend kodu guncelle (git pull)
echo "[1/5] Backend kodu guncelleniyor..."
cd /var/www/vod-manager/app
git pull --ff-only 2>/dev/null || git pull || echo "  WARN: git pull basarisiz, devam ediliyor"

# 2. Nginx config yenile (port 8080 ve /hls-proxy/ ekle)
echo "[2/5] Nginx config guncelleniyor..."
cp "$BACKEND_DIR/../infra/nginx/vod-manager.conf" /etc/nginx/sites-available/vod-manager

# server_name placeholder'i gercek IP ile degistir
sed -i 's/YOUR_SERVER_IP/62.210.92.252/g' /etc/nginx/sites-available/vod-manager

nginx -t && systemctl reload nginx
echo "  Nginx yeniden yuklendi"

# 3. Firewall: port 8080 ac
echo "[3/5] Firewall port 8080 aciliyor..."
ufw allow 8080/tcp 2>/dev/null || true
echo "  Port 8080 acildi"

# 4. Mevcut lokal playlist stream_url duzelt (NULL yap — artik /hls/ uzerinden serve edilecek)
echo "[4/5] Lokal playlist stream_url duzeltiliyor..."
PGPASSWORD="V0dM4n4g3r_Pr0d_2024_xK9mZ" psql -U vod_user -d vod_manager -c "
    UPDATE playlists
    SET stream_url = NULL
    WHERE server_id IS NULL
      AND stream_url LIKE '%/streams/%';
" && echo "  Lokal playlist stream_url temizlendi" || echo "  WARN: psql guncellemesi basarisiz"

# 5. LB server nginx config kopyala (LB sunucusu icin bilgi)
echo "[5/5] LB sunucu nginx config kontrol ediliyor..."
echo "  LB sunucu (138.201.196.89) icin nginx config: infra/nginx/lb-server.conf"
echo "  LB sunucuda calistir:"
echo "    scp /var/www/vod-manager/app/infra/nginx/lb-server.conf root@138.201.196.89:/etc/nginx/sites-available/lb-server"
echo "    ssh root@138.201.196.89 'ln -sf /etc/nginx/sites-available/lb-server /etc/nginx/sites-enabled/lb-server && nginx -t && systemctl reload nginx'"

# Backend yeniden baslat
echo ""
echo "[+] Backend servisi yeniden baslatiliyor..."
systemctl restart vod-manager-api
sleep 3
systemctl status vod-manager-api --no-pager -l | tail -10

# Test
echo ""
echo "=== Test ==="
echo -n "Health check: "
curl -s http://127.0.0.1:8000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || curl -s http://127.0.0.1:8000/health

echo ""
echo "=== Stream Fix Tamamlandi ==="
echo ""
echo "Test komutlari:"
echo "  # IPTV kullanicisi al:"
echo "  PGPASSWORD='V0dM4n4g3r_Pr0d_2024_xK9mZ' psql -U vod_user -d vod_manager -t -c \"SELECT username, password FROM iptv_users LIMIT 3;\""
echo ""
echo "  # M3U indir:"
echo "  curl -v 'http://62.210.92.252:8080/get.php?username=USER&password=PASS&type=m3u_plus'"
echo ""
echo "  # TV kanal test (channel_id gercek ID ile degistir):"
echo "  curl -v 'http://62.210.92.252:8080/live/tv/USER/PASS/1.ts'"
echo ""
echo "  # VOD kanal test (playlist_id gercek ID ile degistir):"
echo "  curl -v 'http://62.210.92.252:8080/live/USER/PASS/1'"
echo ""
echo "  # LB HLS test:"
echo "  curl -v 'http://138.201.196.89/hls/PLAYLIST_ID/stream.m3u8'"
