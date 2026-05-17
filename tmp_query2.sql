SELECT id, bouquet_id, item_type, item_id FROM bouquet_items WHERE item_type::text = 'info_screen' ORDER BY id;
