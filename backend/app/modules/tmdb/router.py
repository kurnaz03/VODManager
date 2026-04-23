from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decrypt_secret
from app.modules.auth.router import get_current_user_id
from app.modules.settings.service import get_setting

router = APIRouter(prefix="/tmdb", tags=["tmdb"], dependencies=[Depends(get_current_user_id)])

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p/w342"


def _get_api_key(db: Session) -> str:
    encrypted = get_setting(db, "tmdb.api_key")
    if not encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TMDB API anahtari tanimlanmamis")
    return decrypt_secret(encrypted)


def _get_language(db: Session) -> str:
    return get_setting(db, "tmdb.language", "tr-TR") or "tr-TR"


@router.get("/tv/{tmdb_id}/seasons")
def get_tv_seasons(tmdb_id: int, db: Session = Depends(get_db)) -> Any:
    """Fetch all seasons and episodes from TMDB for a TV series."""
    api_key = _get_api_key(db)
    language = _get_language(db)

    try:
        with httpx.Client(base_url=TMDB_BASE, timeout=20.0) as client:
            # Get series details to find season count
            tv_resp = client.get(f"/tv/{tmdb_id}", params={"api_key": api_key, "language": language})
            tv_resp.raise_for_status()
            tv_data = tv_resp.json()

            seasons_out = []
            for season_info in tv_data.get("seasons", []):
                sn = season_info.get("season_number", 0)
                if sn == 0:
                    continue  # skip specials (season 0)

                # Get season details with episodes
                s_resp = client.get(
                    f"/tv/{tmdb_id}/season/{sn}",
                    params={"api_key": api_key, "language": language},
                )
                s_resp.raise_for_status()
                s_data = s_resp.json()

                episodes_out = []
                for ep in s_data.get("episodes", []):
                    still = ep.get("still_path")
                    episodes_out.append({
                        "episode_number": ep.get("episode_number"),
                        "name": ep.get("name"),
                        "overview": ep.get("overview"),
                        "still_path": f"{TMDB_IMG}{still}" if still else None,
                        "runtime": ep.get("runtime"),
                    })

                poster = season_info.get("poster_path")
                seasons_out.append({
                    "season_number": sn,
                    "name": season_info.get("name") or s_data.get("name"),
                    "episode_count": len(episodes_out),
                    "poster": f"{TMDB_IMG}{poster}" if poster else None,
                    "episodes": episodes_out,
                })

        return seasons_out

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TMDB hatasi: {exc.response.text}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TMDB baglantisi kurulamadi: {exc}",
        ) from exc
