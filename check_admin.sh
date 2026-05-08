#!/bin/bash
PGPASSWORD=V0dM4n4g3r_Pr0d_2024_xK9mZ psql -h localhost -U vod_user -d vod_manager -c "SELECT id,username FROM users WHERE username='admin';"
