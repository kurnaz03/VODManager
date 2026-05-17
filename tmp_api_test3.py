import sys, os
sys.path.insert(0, '/var/www/vod-manager/app/backend')
os.chdir('/var/www/vod-manager/app/backend')

# Load env
env_file = '/var/www/vod-manager/shared/env/backend.env'
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

# Import everything so ORM is fully configured
from app.core.database import SessionLocal, engine, Base
from app.modules.users.models import User, Role, UserRoleAssignment, RefreshToken, SystemSetting, ActivityLog
from app.modules.servers.models import Server, ServerMetric, ServerInstallLog
from app.modules.downloads.models import DownloadQueue
from app.modules.settings.models import YoutubeCookieCredential
from app.modules.content.models import MovieCategory, SeriesCategory, TvCategory, RadioCategory, Bouquet, BouquetCategory, MovieContent, SeriesContent, SeriesSeason, SeriesEpisode, TvContent, RadioContent, MusicTrack, MusicPlaylist, MusicPlaylistItem
from app.modules.transcode.models import TranscodeProfile, TranscodeJob
from app.modules.iptv_users.models import IptvUser, UserBouquet
from app.modules.connections.models import UserConnection, UserWatchHistory
from app.modules.openvpn.models import VpnClient, VpnServerConfig
from app.modules.tv.models import TvChannel, TvChannelServer, TvChannelBouquet
from app.modules.backups.models import Backup
from app.modules.torrent.models import TorrentDownload
from app.modules.playlist.models import InfoScreenTemplate, Playlist, PlaylistItem
from sqlalchemy.orm import joinedload

db = SessionLocal()
try:
    # Direct query
    playlists = db.query(Playlist).options(joinedload(Playlist.items)).all()
    print(f"Total playlists: {len(playlists)}")
    for pl in playlists:
        items = pl.items
        print(f"  id={pl.id} name={pl.name} status={pl.status} items={len(items)}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
