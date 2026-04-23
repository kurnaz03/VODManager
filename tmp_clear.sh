#!/bin/bash
sudo -u postgres psql -d vodmanager -c "UPDATE user_connections SET is_active=false;"
sudo -u postgres psql -d vodmanager -c "SELECT COUNT(*) FROM user_connections WHERE is_active=true;"
echo "done"
