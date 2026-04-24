#!/bin/bash
# Fix admin password using correct field name and argon2

cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    # Get all column names
    cols = [c.name for c in User.__table__.columns]
    print('Columns:', cols)
    for col in cols:
        if 'pass' in col.lower() or 'hash' in col.lower():
            val = getattr(u, col, None)
            print(f'  {col}:', str(val)[:30] if val else 'NULL', '| len:', len(str(val)) if val else 0)
    break
db.close()
"
