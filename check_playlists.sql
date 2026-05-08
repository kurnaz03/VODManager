SELECT p.id, p.name, COUNT(pi.id) as item_count 
FROM playlists p 
LEFT JOIN playlist_items pi ON p.id = pi.playlist_id 
WHERE p.status != 'stopped' 
GROUP BY p.id, p.name 
ORDER BY p.id;
