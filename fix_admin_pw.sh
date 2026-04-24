#!/bin/bash
# Reset admin password with valid argon2 hash

cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from app.core.security import hash_password, verify_password

db = SessionLocal()
try:
    # Check current hash
    admin = db.query(User).filter(User.username == 'admin').first()
    if admin:
        print('Current hash:', repr(admin.password_hash))
        print('Hash length:', len(admin.password_hash) if admin.password_hash else 0)
        
        # Create valid argon2 hash
        new_hash = hash_password('admin123')
        print('New hash prefix:', new_hash[:30])
        print('New hash length:', len(new_hash))
        
        # Verify new hash works
        ok = verify_password('admin123', new_hash)
        print('Verify test:', ok)
        
        # Update in DB
        admin.password_hash = new_hash
        db.commit()
        db.refresh(admin)
        print('Password updated in DB')
        
        # Verify from DB
        admin2 = db.query(User).filter(User.username == 'admin').first()
        ok2 = verify_password('admin123', admin2.password_hash)
        print('DB verify after commit:', ok2)
    else:
        print('No admin user found!')
        
    # Also fix gokhan user
    gokhan = db.query(User).filter(User.username == 'gokhan').first()
    if gokhan:
        gokhan.password_hash = hash_password('admin123')
        db.commit()
        print('gokhan password also reset to admin123')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== TEST LOGIN AFTER FIX ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.auth import service
from app.modules.auth.schemas import LoginRequest
db = SessionLocal()
try:
    req = LoginRequest(username='admin', password='admin123')
    result = service.login(db, req)
    print('LOGIN SUCCESS')
    print('Access token:', result.access_token[:30], '...')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
"
