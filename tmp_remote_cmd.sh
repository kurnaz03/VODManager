#!/bin/bash
kill 492200 2>/dev/null || true
sleep 1
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager -c "UPDATE playlists SET status='stopped', ffmpeg_pid=NULL WHERE id=3;"
echo DB_OK
