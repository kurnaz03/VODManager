SELECT p.id, p.name, p.status, p.server_id, s.ip_address, s.server_type FROM playlists p LEFT JOIN servers s ON p.server_id = s.id WHERE p.status != 'stopped' ORDER BY p.id;
