#!/bin/bash
echo "=== User info ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "SELECT id,username,is_active FROM users;"
echo "=== Bouquet categories schema ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "\d bouquet_categories"
echo "=== Check bouquet_items ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "\d bouquet_items" 2>/dev/null || echo "TABLE NOT FOUND"
echo "=== API reset admin password ==="
cd /var/www/vod-manager/app/backend
python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from passlib.hash import argon2
db = SessionLocal()
user = db.query(User).filter(User.username=='admin').first()
if user:
    new_hash = argon2.hash('admin123')
    user.password_hash = new_hash
    db.add(user)
    db.commit()
    print('Password reset to admin123')
else:
    print('User not found')
db.close()
" 2>/dev/null || echo "password reset failed"
