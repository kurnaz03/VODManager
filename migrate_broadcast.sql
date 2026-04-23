ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS broadcast_day VARCHAR(20);
ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS broadcast_channel VARCHAR(100);
ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS channel_logo_url VARCHAR(1000);
SELECT column_name FROM information_schema.columns WHERE table_name='series_contents' AND column_name IN ('broadcast_day','broadcast_channel','channel_logo_url');
