#!/bin/bash
set -e
APP_DIR="/var/www/vod-manager/app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
FRONTEND_DIST="$APP_DIR/frontend-dist"

echo "=== 1. DB Migration ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager << 'SQL'
CREATE TABLE IF NOT EXISTS bouquet_items (
    id SERIAL PRIMARY KEY,
    bouquet_id INTEGER NOT NULL REFERENCES bouquets(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL,
    item_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_id ON bouquet_items(id);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_bouquet_id ON bouquet_items(bouquet_id);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_item_type ON bouquet_items(item_type);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_item_id ON bouquet_items(item_id);
ALTER TABLE bouquet_items DROP CONSTRAINT IF EXISTS chk_bouquet_item_type;
ALTER TABLE bouquet_items ADD CONSTRAINT chk_bouquet_item_type
    CHECK (item_type IN ('tv', 'series', 'vod_channel', 'radio', 'movie'));
SELECT 'Migration OK' as result;
SQL

echo "=== 2. Restart API ==="
systemctl restart vod-manager-api vod-manager-worker
sleep 3

echo "=== 3. Build Frontend ==="
cd "$FRONTEND_DIR"
npm run build

echo "=== 4. Copy Frontend dist ==="
cp -r dist/* "$FRONTEND_DIST/"

echo "=== 5. Reload Nginx ==="
nginx -s reload

echo "=== Deploy DONE ==="
