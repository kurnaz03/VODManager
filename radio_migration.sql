ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL;
ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE radio_contents ADD COLUMN IF NOT EXISTS ffmpeg_pid INTEGER;
UPDATE radio_contents SET is_active = true WHERE stream_url IS NOT NULL;
