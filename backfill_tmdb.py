#!/usr/bin/env python3
"""Backfill missing TMDB metadata for movie_contents with empty poster_url."""
import os
import sys
import base64
import hashlib

sys.path.insert(0, "/var/www/vod-manager/backend")

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import decrypt_secret

SYNC_DB_URL = settings.SYNC_DATABASE_URL
engine = create_engine(SYNC_DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


def get_tmdb_credentials(session):
    row = session.execute(text("SELECT value FROM system_settings WHERE key = 'tmdb.api_key'")).fetchone()
    api_key = decrypt_secret(row[0]) if row and row[0] else None
    row_lang = session.execute(text("SELECT value FROM system_settings WHERE key = 'tmdb.language'")).fetchone()
    language = row_lang[0] if row_lang and row_lang[0] else "tr-TR"
    return api_key, language


def search_tmdb(title, api_key, language):
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{TMDB_BASE_URL}/search/movie",
                params={"api_key": api_key, "language": language, "query": title, "page": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return None
            item = results[0]
            release_date = item.get("release_date") or ""
            poster_path = item.get("poster_path")
            return {
                "tmdb_id": item["id"],
                "title": item.get("title") or item.get("name") or title,
                "overview": item.get("overview"),
                "poster_url": f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None,
                "release_year": int(release_date[:4]) if len(release_date) >= 4 and release_date[:4].isdigit() else None,
                "rating": item.get("vote_average"),
            }
    except Exception as exc:
        print(f"TMDB search error for '{title}': {exc}")
        return None


def main():
    session = SessionLocal()
    try:
        api_key, language = get_tmdb_credentials(session)
        if not api_key:
            print("TMDB API key not found")
            return

        rows = session.execute(text("SELECT id, title FROM movie_contents WHERE poster_url IS NULL OR poster_url = '' ORDER BY id DESC")).fetchall()
        print(f"Found {len(rows)} movies with missing poster_url")
        updated = 0
        for movie_id, title in rows:
            result = search_tmdb(title, api_key, language)
            if result and result["poster_url"]:
                session.execute(
                    text("""
                        UPDATE movie_contents
                        SET tmdb_id = :tmdb_id,
                            title = :title,
                            description = :overview,
                            poster_url = :poster_url,
                            release_year = :release_year,
                            rating = :rating,
                            updated_at = NOW()
                        WHERE id = :id
                    """),
                    {
                        "tmdb_id": result["tmdb_id"],
                        "title": result["title"],
                        "overview": result["overview"],
                        "poster_url": result["poster_url"],
                        "release_year": result["release_year"],
                        "rating": result["rating"],
                        "id": movie_id,
                    },
                )
                session.commit()
                updated += 1
                print(f"Updated: {title} -> {result['poster_url']}")
            else:
                print(f"No TMDB result for: {title}")
        print(f"Done. Updated {updated}/{len(rows)} movies.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
