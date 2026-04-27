#!/bin/bash
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -t -c "SELECT username FROM users LIMIT 5;"
