-- Migration: Radio module - music tracks, playlists and visual content models

-- GOREV 1D: Add visual fields to radio_contents
ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS visual_url VARCHAR(1000);
ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS visual_type VARCHAR(20) DEFAULT 'none';

-- GOREV 1A: Create music_tracks table
CREATE TABLE IF NOT EXISTS music_tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    duration_seconds INTEGER,
    file_path TEXT,
    stream_url TEXT,
    category_id INTEGER REFERENCES radio_categories(id) ON DELETE SET NULL,
    cover_url VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_music_tracks_title ON music_tracks (title);
CREATE INDEX IF NOT EXISTS ix_music_tracks_category_id ON music_tracks (category_id);

-- GOREV 1B: Create music_playlists table
CREATE TABLE IF NOT EXISTS music_playlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visual_url VARCHAR(1000),
    visual_type VARCHAR(20) DEFAULT 'none',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
    ffmpeg_pid INTEGER,
    stream_url VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'stopped',
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_music_playlists_name ON music_playlists (name);
CREATE INDEX IF NOT EXISTS ix_music_playlists_server_id ON music_playlists (server_id);

-- GOREV 1C: Create music_playlist_items table
CREATE TABLE IF NOT EXISTS music_playlist_items (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
    track_id INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_music_playlist_items_playlist_id ON music_playlist_items (playlist_id);
CREATE INDEX IF NOT EXISTS ix_music_playlist_items_track_id ON music_playlist_items (track_id);
