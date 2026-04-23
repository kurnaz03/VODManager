#!/bin/bash
echo "=== /proc/net/dev raw ==="
cat /proc/net/dev | head -8

echo ""
echo "=== awk field test (NR>2 first 5 fields) ==="
awk -F'[: ]+' 'NR>2{print NR, NF, "|"$1"|", "|"$2"|", "|"$3"|"}' /proc/net/dev | head -5

echo ""
echo "=== awk sum rx tx (skipping lo) ==="
awk -F'[: ]+' 'NR>2 && $2 != "lo" {rx+=$3; tx+=$11} END {print "rx="rx " tx="tx}' /proc/net/dev

echo ""
echo "=== DB check: latest server_metrics ==="
mysql -u root vod_manager -e "SELECT id, server_id, network_in_mbps, network_out_mbps, network_rx_bytes, network_tx_bytes, collected_at FROM server_metrics ORDER BY collected_at DESC LIMIT 5;" 2>/dev/null || \
sqlite3 /var/www/vod-manager/app/db.sqlite3 "SELECT id, server_id, network_in_mbps, network_out_mbps, network_rx_bytes, network_tx_bytes, collected_at FROM server_metrics ORDER BY collected_at DESC LIMIT 5;" 2>/dev/null || \
psql -U postgres vod_manager -c "SELECT id, server_id, network_in_mbps, network_out_mbps, network_rx_bytes, network_tx_bytes, collected_at FROM server_metrics ORDER BY collected_at DESC LIMIT 5;" 2>/dev/null || \
echo "DB query failed"

echo ""
echo "=== celery beat / worker status ==="
systemctl status vod-manager-worker --no-pager | head -10

echo ""
echo "=== env file ==="
cat /var/www/vod-manager/app/.env 2>/dev/null | grep -v PASSWORD | grep -v SECRET | grep -v KEY | head -20
