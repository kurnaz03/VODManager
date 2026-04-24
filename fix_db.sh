#!/bin/bash
# Fix PostgreSQL voduser password

echo "=== POSTGRESQL STATUS ==="
systemctl is-active postgresql

echo ""
echo "=== CHECKING CURRENT PG USERS ==="
sudo -u postgres psql -c "\du" 2>/dev/null

echo ""
echo "=== CHECKING PG HBA ==="
cat /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -20

echo ""
echo "=== CURRENT .ENV CONTENT ==="
cat /var/www/vod-manager/app/backend/.env

echo ""
echo "=== ENV EXAMPLE ==="
cat /var/www/vod-manager/app/backend/.env.example

echo ""
echo "=== RESETTING VODUSER PASSWORD ==="
sudo -u postgres psql -c "ALTER USER voduser WITH PASSWORD 'vodpassword';" 2>/dev/null && echo "Password reset OK" || echo "Failed to reset, trying create..."
sudo -u postgres psql -c "CREATE USER voduser WITH PASSWORD 'vodpassword';" 2>/dev/null || echo "User exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vodmanager TO voduser;" 2>/dev/null || echo "DB may not exist"

echo ""
echo "=== CHECK DATABASE EXISTS ==="
sudo -u postgres psql -c "\l" 2>/dev/null | grep -i vod

echo ""
echo "=== TEST DB CONNECTION ==="
PGPASSWORD=vodpassword psql -U voduser -d vodmanager -h localhost -c "SELECT 1;" 2>&1
