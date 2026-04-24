#!/bin/bash
# Fix: Link proper .env and restart with correct env

echo "=== STEP 1: Fix .env symlink ==="
# Backup and replace with symlink to correct env
cp /var/www/vod-manager/app/backend/.env /var/www/vod-manager/app/backend/.env.bak 2>/dev/null
rm /var/www/vod-manager/app/backend/.env
cp /var/www/vod-manager/shared/env/backend.env /var/www/vod-manager/app/backend/.env
chmod 640 /var/www/vod-manager/app/backend/.env
chown www-data:www-data /var/www/vod-manager/app/backend/.env
echo ".env content:"
cat /var/www/vod-manager/app/backend/.env

echo ""
echo "=== STEP 2: Test DB with real password ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -U vod_user -d vod_manager -h 127.0.0.1 -c "SELECT 1 as test;" 2>&1

echo ""
echo "=== STEP 3: Test Python DB connection ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
# Force reload of settings
import importlib
if 'app.core.config' in sys.modules:
    del sys.modules['app.core.config']

from app.core.config import settings
print('DB URL (first 70):', settings.SYNC_DATABASE_URL[:70])
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    r = conn.execute(text('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=chr(112)||chr(117)||chr(98)||chr(108)||chr(105)||chr(99)'))
    print('Table count:', r.fetchone()[0])
    print('DB connection: OK')
"

echo ""
echo "=== STEP 4: Restart uvicorn properly ==="
pkill -f uvicorn 2>/dev/null || true
sleep 2

# Check if there is a systemd service
systemctl list-units --type=service 2>/dev/null | grep -i "uvicorn\|vod\|gunicorn" | head -5

# Check supervisor
supervisorctl status 2>/dev/null | head -10 || echo "supervisor not running"

# Check nginx
systemctl is-active nginx 2>/dev/null

echo ""
echo "=== STEP 5: Start uvicorn ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /tmp/uvicorn_new.log 2>&1 &
UVPID=$!
echo "Uvicorn PID: $UVPID"

sleep 5
echo "=== STEP 6: Test endpoints ==="
curl -s http://127.0.0.1:8000/health && echo " <- health"
curl -s http://127.0.0.1:8000/api/v1/setup/status && echo " <- setup"

echo ""
echo "=== UVICORN LOG ==="
tail -30 /tmp/uvicorn_new.log 2>/dev/null
