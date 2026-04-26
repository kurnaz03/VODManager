-- Dizi indirme destegi icin download_queue tablosuna yeni kolonlar eklenir
-- Bu migration'i sunucuda calistirmak icin:
--   psql -U voduser -d vodmanager -f add_series_download_fields.sql

ALTER TABLE download_queue
    ADD COLUMN IF NOT EXISTS series_id  INTEGER REFERENCES series_contents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS season_id  INTEGER REFERENCES series_seasons(id)   ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS episode_number INTEGER;

-- Indeks performans icin (opsiyonel ama tavsiye edilir)
CREATE INDEX IF NOT EXISTS ix_download_queue_series_id ON download_queue (series_id);
CREATE INDEX IF NOT EXISTS ix_download_queue_season_id  ON download_queue (season_id);
