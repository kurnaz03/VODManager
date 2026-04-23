DELETE FROM bouquet_items WHERE item_type='movie' AND item_id NOT IN (SELECT id FROM movie_contents);
