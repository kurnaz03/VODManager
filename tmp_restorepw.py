import sys, os
sys.path.insert(0, '/var/www/vod-manager/app/backend')
os.chdir('/var/www/vod-manager/app/backend')
env_file = '/var/www/vod-manager/shared/env/backend.env'
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

import psycopg2
db_url = os.environ.get('SYNC_DATABASE_URL', '').replace('postgresql+psycopg2://', 'postgresql://')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

with open('/tmp/old_admin_hash.txt', 'r') as f:
    old_hash = f.read().strip()

cur.execute("UPDATE users SET password_hash=%s WHERE username='admin'", (old_hash,))
conn.commit()
print("Password restored to original hash")
cur.close()
conn.close()
