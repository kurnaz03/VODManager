import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
import os
os.chdir('/var/www/vod-manager/app/backend')

from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS broadcast_day VARCHAR(20)'))
    conn.execute(text('ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS broadcast_channel VARCHAR(100)'))
    conn.execute(text('ALTER TABLE series_contents ADD COLUMN IF NOT EXISTS channel_logo_url VARCHAR(1000)'))
    conn.commit()
    print('DB migration OK - broadcast columns added')
