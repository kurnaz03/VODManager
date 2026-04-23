import os
from argon2 import PasswordHasher
import psycopg2

ph = PasswordHasher()
new_hash = ph.hash('admin123')
print('new hash:', new_hash[:50])

conn = psycopg2.connect(
    host='localhost',
    user='vod_user',
    password='V0dM4n4g3r_Pr0d_2024_xK9mZ',
    dbname='vod_manager'
)
cur = conn.cursor()
cur.execute("UPDATE users SET password_hash = %s WHERE username = 'admin'", (new_hash,))
print('rows updated:', cur.rowcount)
conn.commit()
cur.close()
conn.close()
print('Done! Admin password is now admin123')
