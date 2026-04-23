CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'stopped',
    server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
    current_item_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    total_duration_seconds INTEGER NOT NULL DEFAULT 0,
    loop BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_items (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    transcode_job_id INTEGER NOT NULL REFERENCES transcode_jobs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(1000) NOT NULL DEFAULT '',
    tmdb_id INTEGER,
    tmdb_title VARCHAR(255),
    tmdb_overview TEXT,
    tmdb_poster_url VARCHAR(1000),
    is_visible_in_category BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_playlists_id ON playlists(id);
CREATE INDEX IF NOT EXISTS ix_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS ix_playlist_items_transcode_job_id ON playlist_items(transcode_job_id);
