import sys
import os
os.chdir('/var/www/vod-manager/app/backend')
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from argon2 import PasswordHasher
ph = PasswordHasher()
db = SessionLocal()
users = db.query(User).all()
for u in users:
    print('User:', u.id, u.username)
admin = db.query(User).filter(User.username == 'admin').first()
if admin:
    admin.password_hash = ph.hash('admin123')
    db.add(admin)
    db.commit()
    print('Password reset to admin123')
db.close()
