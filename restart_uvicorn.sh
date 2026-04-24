#!/bin/bash
# Restart uvicorn properly

echo "=== Killing existing uvicorn ==="
pkill -f uvicorn 2>/dev/null
sleep 2

echo "=== Checking port 8000 ==="
ss -tlnp | grep 8000 || echo "Port 8000 free"

echo "=== Starting uvicorn as www-data ==="
cd /var/www/vod-manager/app/backend
su -s /bin/bash www-data -c "
  cd /var/www/vod-manager/app/backend
  /var/www/vod-manager/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    >> /tmp/uvicorn.log 2>&1 &
  echo Uvicorn PID: $!
"

sleep 5
echo "=== Health check ==="
curl -s http://127.0.0.1:8000/health && echo "" && echo "HEALTH OK" || echo "HEALTH FAIL"
curl -s http://127.0.0.1:8000/api/v1/setup/status && echo ""

echo "=== Uvicorn log tail ==="
tail -20 /tmp/uvicorn.log 2>/dev/null
