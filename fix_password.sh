#!/bin/bash
# Check and fix admin password hash

cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
db = SessionLocal()
try:
    users = db.query(User).all()
    for u in users:
        print('User:', u.username, '| Hash prefix:', str(u.hashed_password)[:20] if u.hashed_password else 'NULL', '| Hash len:', len(str(u.hashed_password)) if u.hashed_password else 0)
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
finally:
    db.close()
"

echo ""
echo "=== CHECK BCRYPT vs PASSLIB ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
    print('passlib bcrypt OK')
    # Try to verify with known hash
    test_hash = pwd_context.hash('admin')
    print('Test hash:', test_hash[:30])
    print('Verify test:', pwd_context.verify('admin', test_hash))
except Exception as e:
    print('passlib ERROR:', e)
"

echo ""
echo "=== FIX ADMIN PASSWORD ==="
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal
from app.modules.users.models import User
from app.core.security import get_password_hash
db = SessionLocal()
try:
    admin = db.query(User).filter(User.username == 'admin').first()
    if admin:
        new_hash = get_password_hash('admin123')
        admin.hashed_password = new_hash
        db.commit()
        print('Admin password reset to: admin123')
        print('New hash prefix:', new_hash[:20])
    else:
        print('No admin user found')
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
    import traceback
    traceback.print_exc()
finally:
    db.close()
"

echo ""
echo "=== VERIFY LOGIN NOW ==="
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
    print('Login SUCCESS! Token type:', result.token_type if hasattr(result, 'token_type') else 'OK')
except Exception as e:
    print('Login ERROR:', type(e).__name__, str(e)[:300])
    import traceback
    traceback.print_exc()
finally:
    db.close()
"
