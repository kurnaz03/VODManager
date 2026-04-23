#!/bin/bash
# Check DB state
echo "=== DB State ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "SELECT id,name,status,ffmpeg_pid,started_at FROM playlists WHERE id=2;"
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "SELECT id,playlist_id,title,duration_seconds FROM playlist_items WHERE playlist_id=2;"

# Check if ffmpeg still running
echo "=== FFmpeg Processes ==="
ps aux | grep ffmpeg | grep -v grep

# Check bouquets table
echo "=== Bouquets tables ==="
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "\dt" | grep -i bouquet

# Check auth endpoint  
echo "=== Auth endpoint test ==="
curl -sv -XPOST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' 2>&1 | head -20

# Check the routes available
echo "=== API Routes ==="
curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json;d=json.load(sys.stdin);paths=[p for p in d.get('paths',{}) if 'auth' in p.lower()];[print(p) for p in paths[:10]]" 2>/dev/null
