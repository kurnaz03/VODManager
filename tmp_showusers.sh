#!/bin/bash
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h 127.0.0.1 -U vod_user -d vod_manager -c "SELECT id, username, email, status, password_hash FROM users;"
