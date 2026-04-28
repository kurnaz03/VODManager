# VOD Manager Panel

Comprehensive VOD and Live TV management panel running on Ubuntu 22.04/24.04.

## Features

- Live channel management (M3U/M3U+, Xtream Codes API compatibility)
- VOD (movies & series) library with YouTube download support
- HLS stream proxying and transcoding (FFmpeg)
- Multi-server load balancing with SSH management
- IPTV user management with bouquet system
- Celery background task queue (downloads, transcoding, health checks)
- Auto-update system (daily check + manual button)
- JWT authentication with role-based access control
- PostgreSQL + Redis backend
- React + TypeScript frontend (Vite, Tailwind CSS)

## Requirements

- Ubuntu 22.04 or 24.04 (fresh server recommended)
- Root access
- Min 2 GB RAM, 2 vCPU, 20 GB disk
- Ports open: 80 (HTTP), 8080 (IPTV stream endpoint)

## Quick Install (Tek Komut)

```bash
curl -sSL https://raw.githubusercontent.com/kurnaz03/VODManager/main/deploy/install.sh | bash
```

Or step by step:

```bash
wget https://raw.githubusercontent.com/kurnaz03/VODManager/main/deploy/install.sh
chmod +x install.sh
bash install.sh
```

The installer will:
1. Install Nginx, PostgreSQL, Redis, Python 3, Node.js 20, FFmpeg
2. Clone the repository to `/var/www/vod-manager/app/`
3. Create Python virtual environment and install dependencies
4. Create PostgreSQL database and user
5. Run database migrations (create all tables)
6. Create admin user (`admin` / `admin123`)
7. Build the React frontend
8. Configure Nginx (port 80 + port 8080 for IPTV)
9. Create and start systemd services (API + Worker)
10. Install yt-dlp for YouTube downloads

After install:
- **Panel**: `http://YOUR_SERVER_IP/`
- **Login**: `admin` / `admin123`
- **IPTV Endpoint**: `http://YOUR_SERVER_IP:8080`

## IPTV Configuration

### M3U Playlist URL
```
http://YOUR_SERVER_IP:8080/get.php?username=USERNAME&password=PASSWORD&type=m3u_plus
```

### Xtream Codes API (for IPTV players like TiviMate, XCIPTV, iBO Player)
- **Server**: `http://YOUR_SERVER_IP`
- **Port**: `8080`
- **Username**: IPTV user username
- **Password**: IPTV user password

### Supported Xtream Codes API Endpoints
| Endpoint | Description |
|----------|-------------|
| `/player_api.php?username=X&password=Y` | User info + server info |
| `&action=get_live_categories` | Live TV categories |
| `&action=get_vod_categories` | VOD categories |
| `&action=get_series_categories` | Series categories |
| `&action=get_live_streams` | Live TV channels |
| `&action=get_vod_streams` | Movies list |
| `&action=get_series` | Series list |
| `&action=get_series_info&series_id=X` | Series seasons & episodes |
| `&action=get_vod_info&vod_id=X` | Movie details |
| `/panel_api.php?username=X&password=Y` | Panel API (alt.) |

## Configuration

All runtime config lives in `/var/www/vod-manager/shared/env/backend.env`.
Edit it and restart the API service after any change:

```bash
sudo systemctl restart vod-manager-api
```

Key environment variables:
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SYNC_DATABASE_URL` | PostgreSQL sync connection string |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY` | JWT signing key (auto-generated) |
| `SERVER_HOST` | Server IP address |
| `SHARED_STORAGE_PATH` | Shared storage path |

## Auto-Update

The panel includes a built-in update system:

- **Manual**: Settings > Panel Guncelleme > "Guncelleme Kontrol" button
- **Automatic**: Celery beat checks daily at 04:00 UTC

Update process: `git pull` → `npm run build` → `systemctl restart`

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Task queue | Celery + Redis (Beat scheduler) |
| Database | PostgreSQL |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Streaming | FFmpeg, HLS |
| Downloads | yt-dlp (H264+AAC, faststart) |
| Web server | Nginx |
| Process manager | systemd |

## Project Structure

```
├── backend/              FastAPI application
│   ├── app/
│   │   ├── api/v1/       API route aggregator
│   │   ├── core/         Config, security, database, Celery
│   │   └── modules/
│   │       ├── admin/    Auto-update system
│   │       ├── auth/     Authentication + dashboard
│   │       ├── content/  Series, movies, bouquets, categories
│   │       ├── connections/  Connection tracking
│   │       ├── downloads/   YouTube download queue
│   │       ├── iptv_users/  IPTV user management
│   │       ├── playlist/    M3U + EPG generation
│   │       ├── servers/     LB server management
│   │       ├── stream/      Xtream Codes API + streaming
│   │       ├── transcode/   FFmpeg transcoding
│   │       ├── tv/          Live TV channels
│   │       └── users/       Admin user management
│   └── scripts/          Utility scripts
├── frontend/             React SPA
│   └── src/
│       ├── components/   Shared UI components
│       └── modules/      Feature modules (dashboard, settings, etc.)
├── deploy/
│   └── install.sh        One-command installer
└── infra/
    └── nginx/            Nginx configuration
```

## Services

| Service | Description |
|---------|-------------|
| `vod-manager-api` | FastAPI / Uvicorn (port 8000) |
| `vod-manager-worker` | Celery worker + Beat |

```bash
sudo systemctl status vod-manager-api
sudo systemctl status vod-manager-worker
sudo systemctl restart vod-manager-api vod-manager-worker
sudo journalctl -u vod-manager-api -f
```

## License

Private — all rights reserved.
