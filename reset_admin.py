import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.security import hash_password
from sqlalchemy import create_engine, text

pw_hash = hash_password('admin123')
print(f'Hash: {pw_hash[:30]}...')

engine = create_engine('postgresql://vod_user:V0dM4n4g3r_Pr0d_2024_xK9mZ@localhost/vod_manager')
with engine.connect() as conn:
    conn.execute(text("UPDATE users SET password_hash = :h WHERE username = 'admin'"), {'h': pw_hash})
    conn.commit()
    print('Password reset to admin123')
