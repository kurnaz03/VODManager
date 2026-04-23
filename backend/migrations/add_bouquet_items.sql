-- Migration: Add bouquet_items table
-- Run this on the production database

CREATE TABLE IF NOT EXISTS bouquet_items (
    id SERIAL PRIMARY KEY,
    bouquet_id INTEGER NOT NULL REFERENCES bouquets(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL,
    item_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bouquet_items_id ON bouquet_items(id);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_bouquet_id ON bouquet_items(bouquet_id);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_item_type ON bouquet_items(item_type);
CREATE INDEX IF NOT EXISTS ix_bouquet_items_item_id ON bouquet_items(item_id);

-- Add check constraint for item_type
ALTER TABLE bouquet_items DROP CONSTRAINT IF EXISTS chk_bouquet_item_type;
ALTER TABLE bouquet_items ADD CONSTRAINT chk_bouquet_item_type
    CHECK (item_type IN ('tv', 'series', 'vod_channel', 'radio', 'movie'));
