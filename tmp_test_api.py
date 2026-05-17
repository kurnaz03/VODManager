import sys, os
os.chdir('/var/www/vod-manager/app/backend')
sys.path.insert(0, '/var/www/vod-manager/app/backend')

from dotenv import load_dotenv
load_dotenv('/var/www/vod-manager/shared/env/backend.env')

import app.modules.transcode.models
from app.core.database import SessionLocal
from app.modules.playlist.broadcast import get_all_now_playing

db = SessionLocal()
try:
    result = get_all_now_playing(db)
    print(f'Total channels: {len(result)}')
    for ch in result:
        print(f"  #{ch['channel_number']} {ch['playlist_name']} [{ch['status']}] -> {ch.get('current_title', 'N/A')}")
except Exception as e:
    print(f'ERROR: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
