import sys
import os
sys.path.insert(0, '/var/www/vod-manager/app/backend')
os.chdir('/var/www/vod-manager/app/backend')

# Load env like the service does
env_file = '/var/www/vod-manager/shared/env/backend.env'
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

from app.core.database import SessionLocal
import app.modules.playlist.models  # ensure all models loaded
import app.modules.transcode.models
from app.modules.playlist.broadcast import get_all_now_playing

db = SessionLocal()
try:
    r = get_all_now_playing(db)
    print("OK - Count:", len(r))
    for ch in r:
        print(" -", ch["playlist_name"], "status:", ch["status"], "current:", ch["current_title"])
except Exception as e:
    print("ERROR:", e)
    import traceback
    traceback.print_exc()
finally:
    db.close()
