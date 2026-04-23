#!/bin/bash
# Quick verification after deploy
echo "=== API Status ==="
systemctl is-active vod-manager-api

echo ""
echo "=== Test bouquets endpoint ==="
python3 -c "
import urllib.request, json
req = urllib.request.Request(
  'http://localhost:8000/api/v1/bouquets',
)
try:
  resp = urllib.request.urlopen(req)
  d = json.loads(resp.read())
  print('BOUQUETS_COUNT:', len(d))
  if d:
    print('FIRST_BOUQUET:', d[0].get('name'), 'item_count:', d[0].get('item_count'), 'category_count:', d[0].get('category_count'))
except Exception as e:
  print('ERROR:', e)
"

echo ""
echo "=== Test playlists endpoint (check items included) ==="
python3 -c "
import urllib.request, json
req = urllib.request.Request('http://localhost:8000/api/v1/playlists')
try:
  resp = urllib.request.urlopen(req)
  d = json.loads(resp.read())
  print('PLAYLISTS_COUNT:', len(d))
  if d:
    pl = d[0]
    print('FIRST_PL:', pl.get('name'), 'status:', pl.get('status'), 'items_len:', len(pl.get('items',[])))
except Exception as e:
  print('ERROR:', e)
"

echo ""
echo "=== Check bouquet_items table ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "\d bouquet_items"
