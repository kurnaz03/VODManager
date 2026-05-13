-- Migration: Music playlist categories + radio channel items

ALTER TABLE music_playlists ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES radio_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_music_playlists_category_id ON music_playlists (category_id);

ALTER TABLE music_playlist_items ADD COLUMN IF NOT EXISTS radio_channel_id INTEGER REFERENCES radio_contents(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_music_playlist_items_radio_channel_id ON music_playlist_items (radio_channel_id);

-- track_id artik nullable (track veya radio kanali olabilir)
ALTER TABLE music_playlist_items ALTER COLUMN track_id DROP NOT NULL;
