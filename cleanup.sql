DELETE FROM bouquet_items WHERE item_type='vod_channel' AND item_id NOT IN (SELECT id FROM playlists);
DELETE FROM bouquet_items WHERE item_type='movie' AND item_id NOT IN (SELECT id FROM movies);
UPDATE user_connections SET country_code='', country_name='', isp_name='' WHERE 1=0;
