#!/bin/bash
cd /var/www/vod-manager/app/backend
PYTHONPATH=/var/www/vod-manager/app/backend /var/www/vod-manager/venv/bin/python << 'EOF'
import sys
sys.path.insert(0, "/var/www/vod-manager/app/backend")
from app.core.database import SessionLocal
from app.modules.users.models import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter(User.username == "admin").first()
u.password_hash = hash_password("admin123")
db.commit()
print("Password reset OK - argon2")
EOF
