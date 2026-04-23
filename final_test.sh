#!/bin/bash
echo "=== M3U8 from /live/ ==="
curl -s http://localhost:8080/live/gkhan/k0x20glnzp51/2.ts | head -6

echo ""
echo "=== Disk segment count ==="
ls /var/www/vod-manager/shared/hls/2/seg_*.ts | wc -l

echo ""
echo "=== Test segment from stream.m3u8 ==="
SEG=$(curl -s http://localhost:8080/hls/2/stream.m3u8 | grep '\.ts$' | head -1 | tr -d '\r')
echo "Segment: $SEG"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/hls/2/$SEG)
echo "HTTP: $HTTP"

echo ""
echo "=== Test segment from /live/ m3u8 ==="
URL=$(curl -s http://localhost:8080/live/gkhan/k0x20glnzp51/2.ts | grep 'http' | head -1 | tr -d '\r')
echo "URL: $URL"
HTTP2=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
echo "HTTP: $HTTP2"
