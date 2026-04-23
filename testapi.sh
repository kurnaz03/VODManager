#!/bin/bash
python3 -c "import json; open('/tmp/login.json','w').write(json.dumps({'username':'admin','password':'Kia2014x'}))"
TOKEN=$(curl -s -XPOST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' --data-binary @/tmp/login.json | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
echo "TOKEN_LEN:${#TOKEN}"
curl -s "http://localhost:8000/api/v1/playlists/2" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print('status:',d.get('status'));print('item_count:',d.get('item_count'));items=d.get('items',[]);print('items_len:',len(items));print('item0:',items[0].get('title') if items else 'EMPTY')"
echo "--- list endpoint ---"
curl -s "http://localhost:8000/api/v1/playlists" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);pl=[x for x in d if x.get('id')==2];print('list_status:',pl[0].get('status') if pl else 'NOT_FOUND');print('list_items_len:',len(pl[0].get('items',[])) if pl else 'N/A')"
echo "--- DB check ---"
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "SELECT id,name,status,ffmpeg_pid FROM playlists WHERE id=2; SELECT count(*) as item_count FROM playlist_items WHERE playlist_id=2;"
