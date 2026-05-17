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

from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Hash a test password
test_pass = "TestPass123!"
h = pwd.hash(test_pass)
print("HASH:", h)

import psycopg2
conn = psycopg2.connect(os.environ.get('SYNC_DATABASE_URL', '').replace('postgresql+psycopg2://', 'postgresql://'))
cur = conn.cursor()
cur.execute("SELECT id, username, hashed_password FROM users WHERE username='admin'")
row = cur.fetchone()
print("Admin id:", row[0], "username:", row[1])
old_hash = row[2]

cur.execute("UPDATE users SET hashed_password=%s WHERE username='admin'", (h,))
conn.commit()
print("Updated admin password to:", test_pass)
cur.close()
conn.close()
