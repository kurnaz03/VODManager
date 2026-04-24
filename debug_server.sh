#!/bin/bash
# Debug script for VOD Manager API

echo "=== SETUP STATUS ==="
curl -s http://127.0.0.1:8000/api/v1/setup/status

echo ""
echo "=== DB CONNECTION TEST ==="
cd /var/www/vod-manager/app/backend
export PYTHONPATH=/var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 << 'PYEOF'
import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
try:
    from app.core.database import engine, SessionLocal
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("DB connection: OK")
        
    db = SessionLocal()
    result = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
    tables = [row[0] for row in result]
    print("Tables:", tables)
    db.close()
except Exception as e:
    print("DB ERROR:", type(e).__name__, str(e))
PYEOF

echo ""
echo "=== LOGIN TEST ==="
/var/www/vod-manager/venv/bin/python3 << 'PYEOF'
import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
try:
    from app.core.database import SessionLocal
    from app.modules.auth import service
    from app.modules.auth.schemas import LoginRequest
    db = SessionLocal()
    req = LoginRequest(username="admin", password="admin")
    try:
        result = service.login(db, req)
        print("Login OK:", result)
    except Exception as e:
        print("Login ERROR:", type(e).__name__, str(e))
    db.close()
except Exception as e:
    print("IMPORT ERROR:", type(e).__name__, str(e))
PYEOF

echo ""
echo "=== SETUP STATUS CHECK ==="
/var/www/vod-manager/venv/bin/python3 << 'PYEOF'
import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
try:
    from app.core.database import SessionLocal
    from app.modules.auth import service
    db = SessionLocal()
    result = service.get_setup_status(db)
    print("Setup status:", result)
    db.close()
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
PYEOF

echo ""
echo "=== UVICORN ERROR LOGS ==="
ps aux | grep uvicorn | grep -v grep
journalctl --since "1 hour ago" -n 200 --no-pager 2>/dev/null | grep -i "error\|exception\|traceback" | tail -50

echo ""
echo "=== RECENT SYSTEM ERRORS ==="
journalctl --since "1 hour ago" --no-pager -p err 2>/dev/null | tail -20
