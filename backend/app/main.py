from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine, SessionLocal, Base
from app.core.middleware import MaintenanceModeMiddleware
from app.modules.users.models import (  # noqa: F401 - ensures tables are registered
    User, Role, UserRoleAssignment, RefreshToken, SystemSetting, ActivityLog
)
from app.modules.servers.models import Server, ServerMetric, ServerInstallLog  # noqa: F401
from app.modules.downloads.models import DownloadQueue  # noqa: F401
from app.modules.settings.models import YoutubeCookieCredential  # noqa: F401
from app.modules.content.models import (  # noqa: F401
    MovieCategory, SeriesCategory, TvCategory, RadioCategory, Bouquet, BouquetCategory,
    MovieContent, SeriesContent, SeriesSeason, SeriesEpisode, TvContent, RadioContent,
    MusicTrack, MusicPlaylist, MusicPlaylistItem,
)
from app.modules.transcode.models import TranscodeProfile, TranscodeJob  # noqa: F401
from app.modules.iptv_users.models import IptvUser, UserBouquet  # noqa: F401
from app.modules.connections.models import UserConnection, UserWatchHistory  # noqa: F401
from app.modules.openvpn.models import VpnClient, VpnServerConfig  # noqa: F401
from app.modules.tv.models import TvChannel, TvChannelServer, TvChannelBouquet  # noqa: F401
from app.modules.backups.models import Backup  # noqa: F401
from app.modules.torrent.models import TorrentDownload  # noqa: F401
from app.modules.roles.seed import seed_roles
from app.api.v1.router import api_router
from app.modules.stream.router import router as stream_router
from app.modules.servers.service import ensure_main_server
from app.modules.content.seed import ensure_default_categories
from app.modules.transcode.service import ensure_default_vod_profile
from app.modules.dashboard.geoip import load_csv as load_geoip_csv
from app.modules.torrent.service import start_session_and_monitor

limiter = Limiter(key_func=get_remote_address)

UPLOADS_DIR = Path("/var/www/vod-manager/shared/uploads")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev mode; use Alembic for production)
    Base.metadata.create_all(bind=engine)

    # Seed default roles
    db: Session = SessionLocal()
    try:
        seed_roles(db)
        ensure_main_server(db)
        ensure_default_categories(db)
        ensure_default_vod_profile(db)
    finally:
        db.close()

    # Load offline GeoIP CSV (non-blocking — logs warning if file absent)
    load_geoip_csv()

    # Start libtorrent session + monitor thread (no-op if libtorrent not installed)
    start_session_and_monitor()

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(MaintenanceModeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(stream_router)

# Serve uploaded files (logos, etc.)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
