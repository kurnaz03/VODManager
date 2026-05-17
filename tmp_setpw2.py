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

from argon2 import PasswordHasher
import psycopg2

ph = PasswordHasher()
test_pass = "TestPass123!"
new_hash = ph.hash(test_pass)

db_url = os.environ.get('SYNC_DATABASE_URL', '').replace('postgresql+psycopg2://', 'postgresql://')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get current hash
cur.execute("SELECT id, username, password_hash FROM users WHERE username='admin'")
row = cur.fetchone()
print("Admin id:", row[0], "username:", row[1])
old_hash = row[2]

# Save old hash to file for restoration
with open('/tmp/old_admin_hash.txt', 'w') as f:
    f.write(old_hash)

# Set new test password
cur.execute("UPDATE users SET password_hash=%s WHERE username='admin'", (new_hash,))
conn.commit()
print("Password updated to:", test_pass)
cur.close()
conn.close()
