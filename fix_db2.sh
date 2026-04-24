#!/bin/bash
# Fix: Set correct DB credentials

echo "=== STEP 1: Check vod_user details ==="
sudo -u postgres psql -c "\du vod_user" 2>/dev/null
sudo -u postgres psql -c "\l vod_manager" 2>/dev/null

echo ""
echo "=== STEP 2: Set password for vod_user ==="
sudo -u postgres psql -c "ALTER USER vod_user WITH PASSWORD 'vodpassword';" 2>/dev/null && echo "Password set OK"

echo ""
echo "=== STEP 3: Test connection with correct name ==="
PGPASSWORD=vodpassword psql -U vod_user -d vod_manager -h 127.0.0.1 -c "SELECT 1 as test;" 2>&1

echo ""
echo "=== STEP 4: Write .env file ==="
cat > /var/www/vod-manager/app/backend/.env << 'ENVEOF'
APP_NAME=VOD Manager
APP_VERSION=1.0.0
DEBUG=false
SECRET_KEY=vod-manager-super-secret-key-2024-production-secure
DATABASE_URL=postgresql+asyncpg://vod_user:vodpassword@localhost:5432/vod_manager
SYNC_DATABASE_URL=postgresql+psycopg2://vod_user:vodpassword@localhost:5432/vod_manager
REDIS_URL=redis://localhost:6379/0
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://62.210.92.252
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SETUP=3/minute
FERNET_KEY=
SHARED_STORAGE_ROOT=/var/www/vod-manager/storage
MAIN_SERVER_NAME=Main Server
MAIN_SERVER_IP=62.210.92.252
MAIN_SERVER_SSH_PORT=22
MAIN_SERVER_SSH_USERNAME=root
MAIN_SERVER_SSH_PASSWORD=Kia2014x
ENVEOF
echo ".env written"
cat /var/www/vod-manager/app/backend/.env

echo ""
echo "=== STEP 5: Test DB connection with new .env ==="
cd /var/www/vod-manager/app/backend
/var/www/vod-manager/venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.config import settings
print('SYNC_URL:', settings.SYNC_DATABASE_URL[:60])
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    r = conn.execute(text('SELECT COUNT(*) FROM pg_tables WHERE schemaname=chr(112)||chr(117)||chr(98)||chr(108)||chr(105)||chr(99)'))
    print('Table count:', r.fetchone()[0])
    print('DB connection: OK')
"

echo ""
echo "=== STEP 6: Restart uvicorn ==="
pkill -f uvicorn
sleep 2
cd /var/www/vod-manager/app/backend
nohup /var/www/vod-manager/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --log-level info --access-log > /tmp/uvicorn.log 2>&1 &
sleep 3
echo "Uvicorn PID: $!"
curl -s http://127.0.0.1:8000/health
