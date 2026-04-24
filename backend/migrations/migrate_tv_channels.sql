-- Migration: Create TV Channels module tables
-- Run on server: psql -U vod_manager -d vod_manager -f migrate_tv_channels.sql

-- tv_channels
CREATE TABLE IF NOT EXISTS tv_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(1000),
    epg_channel_id VARCHAR(255),
    stream_url TEXT NOT NULL,
    category_id INTEGER REFERENCES tv_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tv_channels_name ON tv_channels(name);
CREATE INDEX IF NOT EXISTS ix_tv_channels_category_id ON tv_channels(category_id);
CREATE INDEX IF NOT EXISTS ix_tv_channels_is_active ON tv_channels(is_active);
CREATE INDEX IF NOT EXISTS ix_tv_channels_sort_order ON tv_channels(sort_order);

-- tv_channel_servers (multi-server assignment)
CREATE TABLE IF NOT EXISTS tv_channel_servers (
    id SERIAL PRIMARY KEY,
    tv_channel_id INTEGER NOT NULL REFERENCES tv_channels(id) ON DELETE CASCADE,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tv_channel_servers_tv_channel_id ON tv_channel_servers(tv_channel_id);
CREATE INDEX IF NOT EXISTS ix_tv_channel_servers_server_id ON tv_channel_servers(server_id);

-- tv_channel_bouquets (bouquet assignment)
CREATE TABLE IF NOT EXISTS tv_channel_bouquets (
    id SERIAL PRIMARY KEY,
    tv_channel_id INTEGER NOT NULL REFERENCES tv_channels(id) ON DELETE CASCADE,
    bouquet_id INTEGER NOT NULL REFERENCES bouquets(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tv_channel_bouquets_tv_channel_id ON tv_channel_bouquets(tv_channel_id);
CREATE INDEX IF NOT EXISTS ix_tv_channel_bouquets_bouquet_id ON tv_channel_bouquets(bouquet_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_tv_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tv_channels_updated_at ON tv_channels;
CREATE TRIGGER trg_tv_channels_updated_at
    BEFORE UPDATE ON tv_channels
    FOR EACH ROW EXECUTE FUNCTION update_tv_channels_updated_at();

SELECT 'TV Channels migration completed successfully.' AS result;
