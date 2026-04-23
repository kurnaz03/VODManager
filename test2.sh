#!/bin/bash
# Test mevcut bir segment
EXIST=$(ls /var/www/vod-manager/shared/hls/2/seg_*.ts | head -1)
SEGNAME=$(basename $EXIST)
echo "Testing existing segment: $SEGNAME"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/hls/2/$SEGNAME)
echo "HTTP: $HTTP"

# Nginx error log
echo "=== Nginx errors ==="
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log"

# m3u8 ile disk sync
echo "=== M3U8 last segment ==="
curl -s http://localhost:8080/hls/2/stream.m3u8 | grep '.ts$' | tail -3

echo "=== Disk last segments ==="
ls /var/www/vod-manager/shared/hls/2/seg_*.ts | tail -3
