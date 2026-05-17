import sys
sys.path.insert(0,"/var/www/vod-manager/app/backend")
sys.path.insert(0,"/var/www/vod-manager/app")
from app.core.database import SessionLocal
from app.modules.playlist.models import Playlist
from app.modules.playlist.broadcast import get_all_now_playing
db=SessionLocal()
r=get_all_now_playing(db)
print("Count:",len(r))
for x in r[:5]:
    print(x)
