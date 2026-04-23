# VOD Manager Panel

Comprehensive VOD and Live TV management panel running on Ubuntu 22.04/24.04.

## Features

- Live channel management (M3U/M3U+, Xtream API compatibility)
- VOD (movies & series) library with metadata
- HLS stream proxying and transcoding (FFmpeg)
- Multi-server SSH management
- Celery background task queue (channel health checks, transcoding jobs)
- JWT authentication with role-based access control
- Fernet-encrypted credential storage
- PostgreSQL + Redis backend
- React + TypeScript frontend (Vite, Tailwind CSS)

## Requirements

- Ubuntu 22.04 or 24.04 (fresh server recommended)
- Root / sudo access
- Min 2 GB RAM, 2 vCPU, 20 GB disk
- Ports open: 22 (SSH), 80 (HTTP), 8080 (stream endpoint)

## Quick Install

```bash
git clone https://github.com/YOUR_USERNAME/vod-manager.git
cd vod-manager
sudo bash install.sh
```

The installer will:
1. Install Nginx, PostgreSQL, Redis, Python 3, Node 18, FFmpeg
2. Create the database and a random password
3. Build the React frontend
4. Generate `SECRET_KEY` and `FERNET_KEY` automatically
5. Configure Nginx and systemd services
6. Open firewall ports 80 and 8080

After install, open **http://YOUR_SERVER_IP/** in your browser.

## Configuration

All runtime config lives in `/var/www/vod-manager/shared/env/backend.env`.  
Edit it and restart the API service after any change:

```bash
sudo systemctl restart vod-manager-api
```

See `backend/.env.example` for a full list of supported variables.

## Manual / Development Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements/base.txt
cp .env.example .env   # then edit .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Panel: <http://localhost:5173>  
API Docs: <http://localhost:8000/api/docs>

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy (async), Alembic |
| Task queue | Celery + Redis (Beat scheduler) |
| Database | PostgreSQL |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Streaming | FFmpeg, HLS |
| Web server | Nginx |
| Process manager | systemd |

## Project Structure

```
├── backend/           FastAPI application
│   ├── app/
│   │   ├── api/       Route handlers
│   │   ├── core/      Config, security, Celery
│   │   ├── models/    SQLAlchemy models
│   │   ├── schemas/   Pydantic schemas
│   │   └── services/  Business logic
│   ├── alembic/       DB migrations
│   └── requirements/
├── frontend/          React SPA
│   └── src/
├── infra/
│   ├── nginx/         vod-manager.conf
│   ├── systemd/       service unit files
│   └── scripts/
├── install.sh         One-command installer
└── backend/.env.example
```

## Services

| Service | Description |
|---------|-------------|
| `vod-manager-api` | FastAPI / Uvicorn (port 8000) |
| `vod-manager-worker` | Celery worker + Beat |

```bash
sudo systemctl status vod-manager-api
sudo systemctl status vod-manager-worker
sudo journalctl -u vod-manager-api -f
```

## License

Private — all rights reserved.