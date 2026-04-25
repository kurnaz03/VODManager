from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.content.router import router as content_router
from app.modules.downloads.router import router as downloads_router
from app.modules.files.router import router as files_router
from app.modules.servers.router import router as servers_router
from app.modules.settings.router import router as settings_router
from app.modules.tmdb.router import router as tmdb_router
from app.modules.transcode.router import router as transcode_router, job_router as transcode_job_router
from app.modules.playlist.router import router as playlist_router, epg_router as playlist_epg_router
from app.modules.iptv_users.router import router as iptv_users_router
from app.modules.openvpn.router import router as openvpn_router
from app.modules.tv.router import router as tv_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(servers_router)
api_router.include_router(content_router)
api_router.include_router(downloads_router)
api_router.include_router(settings_router)
api_router.include_router(tmdb_router)
api_router.include_router(files_router)
api_router.include_router(transcode_router)
api_router.include_router(transcode_job_router)
api_router.include_router(playlist_epg_router)
api_router.include_router(playlist_router)
api_router.include_router(iptv_users_router)
api_router.include_router(openvpn_router)
api_router.include_router(tv_router)
