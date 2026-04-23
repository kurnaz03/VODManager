#!/bin/bash
echo "=== M3U8 content ==="
curl -s http://localhost:8080/hls/2/stream.m3u8 | head -8

echo ""
echo "=== Segment test ==="
SEG=$(curl -s http://localhost:8080/hls/2/stream.m3u8 | grep '\.ts' | head -1 | tr -d '\r')
echo "Segment: $SEG"
HTTP=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/hls/2/$SEG)
echo "HTTP Status: $HTTP"

echo ""
echo "=== Nginx error (last 5 lines) ==="
tail -5 /var/log/nginx/error.log

echo ""
echo "=== HLS dir permissions ==="
ls -la /var/www/vod-manager/shared/hls/2/ | head -5
