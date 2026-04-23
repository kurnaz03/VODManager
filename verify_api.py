import urllib.request
import json

# Login
req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/login',
    data=json.dumps({'username': 'admin', 'password': 'admin123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
resp = json.loads(urllib.request.urlopen(req).read())
token = resp.get('access_token', '')
print('TOKEN LEN:', len(token))

# Test playlists (check items)
req2 = urllib.request.Request(
    'http://localhost:8000/api/v1/playlists',
    headers={'Authorization': 'Bearer ' + token}
)
data = json.loads(urllib.request.urlopen(req2).read())
print('PLAYLISTS_COUNT:', len(data))
for pl in data:
    print(' PL:', pl['id'], pl['name'], 'status:', pl['status'], 'items_len:', len(pl.get('items', [])))

# Test bouquets
req3 = urllib.request.Request(
    'http://localhost:8000/api/v1/bouquets',
    headers={'Authorization': 'Bearer ' + token}
)
data3 = json.loads(urllib.request.urlopen(req3).read())
print('BOUQUETS_COUNT:', len(data3))
for bq in data3:
    print(' BQ:', bq['id'], bq['name'], 'item_count:', bq.get('item_count'), 'category_count:', bq.get('category_count'))

# Test bouquet items endpoint
if data3:
    bq_id = data3[0]['id']
    req4 = urllib.request.Request(
        f'http://localhost:8000/api/v1/bouquets/{bq_id}/items',
        headers={'Authorization': 'Bearer ' + token}
    )
    items = json.loads(urllib.request.urlopen(req4).read())
    print('BOUQUET_ITEMS:', len(items))
