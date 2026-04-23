#!/bin/bash
echo "=== Tables ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c '\dt'
echo "=== Auth test ==="
python3 -c "
import urllib.request, json
req = urllib.request.Request(
  'http://localhost:8000/api/v1/auth/login',
  data=json.dumps({'username':'admin','password':'Kia2014x'}).encode(),
  headers={'Content-Type':'application/json'}
)
try:
  resp = urllib.request.urlopen(req)
  d = json.loads(resp.read())
  print('LOGIN OK, token:', d.get('access_token','')[:30])
except Exception as e:
  print('LOGIN ERROR:', e)
"
