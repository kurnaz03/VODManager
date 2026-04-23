import subprocess, json
creds = json.dumps({'username': 'admin', 'password': 'admin'})
login = subprocess.run(['curl','-s','http://localhost:8000/api/v1/auth/login','-X','POST','-H','Content-Type: application/json','--data',creds], capture_output=True, text=True)
data = json.loads(login.stdout)
print('Login:', json.dumps(data)[:200])
tok = data.get('access_token','')
users_r = subprocess.run(['curl','-s','http://localhost:8000/api/v1/iptv-users','-H','Authorization: Bearer '+tok], capture_output=True, text=True)
users = json.loads(users_r.stdout)
print('Users count:', len(users) if isinstance(users,list) else 'error:'+str(users)[:100])
if isinstance(users,list):
    for u in users[:5]:
        print('  id=%s user=%s isp=%s country=%s active=%s' % (u['id'],u['username'],u.get('last_isp'),u.get('last_country_code'),u.get('active_connections')))
