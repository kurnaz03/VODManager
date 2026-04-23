#!/bin/bash
set -e
export PGPASSWORD="V0dM4n4g3r_Pr0d_2024_xK9mZ"
PSQL="psql -U vod_user -d vod_manager -h localhost"

echo "=== Running DB migration ==="
$PSQL <<'SQL'
ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS domain_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS max_clients INTEGER,
  ADD COLUMN IF NOT EXISTS network_interface VARCHAR(64),
  ADD COLUMN IF NOT EXISTS network_speed INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS http_port INTEGER DEFAULT 8080,
  ADD COLUMN IF NOT EXISTS https_port INTEGER DEFAULT 8443,
  ADD COLUMN IF NOT EXISTS rtmp_port INTEGER DEFAULT 25462;
SQL

echo "=== Migration complete, verifying columns ==="
$PSQL -c "\d servers" | grep -E "domain_name|max_clients|network_interface|network_speed|http_port|https_port|rtmp_port"
echo "=== Done ==="
