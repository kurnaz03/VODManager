#!/bin/bash
cd /var/www/vod-manager/app/backend
python3 << 'PYEOF'
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from passlib.hash import argon2
db = SessionLocal()
users = db.query(User).all()
for u in users:
    print('User:', u.id, u.username)
# Reset admin password to admin123
admin = db.query(User).filter(User.username == 'admin').first()
if admin:
    admin.password_hash = argon2.hash('admin123')
    db.add(admin)
    db.commit()
    print('Password reset to admin123')
db.close()
PYEOF
