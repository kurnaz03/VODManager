-- Delete duplicate info_screen items, keep only the first one per bouquet
DELETE FROM bouquet_items 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY bouquet_id, item_type ORDER BY id) as rn
        FROM bouquet_items 
        WHERE item_type::text = 'info_screen'
    ) t WHERE rn > 1
);
