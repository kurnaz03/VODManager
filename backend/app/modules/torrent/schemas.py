from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


TorrentCategoryLiteral = Literal["movie", "series"]
TorrentStatusLiteral = Literal["downloading", "seeding", "completed", "paused", "error", "queued"]


class TorrentAddRequest(BaseModel):
    magnet_link: str = Field(min_length=10)
    name: str | None = Field(default=None, max_length=500)
    category: TorrentCategoryLiteral
    category_id: int | None = Field(default=None, ge=1)
    season_number: int | None = Field(default=None, ge=1, description="Dizi icin hedef sezon numarasi")
    episode_number: int | None = Field(default=None, ge=1, description="Bos ise tum videolar otomatik bolumlenir")
    no_seed: bool = Field(default=True, description="Indirme tamamlaninca seeding durdur")
    tmdb_id: int | None = Field(default=None, ge=1)
    tmdb_poster_url: str | None = Field(default=None, max_length=1000)
    tmdb_overview: str | None = Field(default=None, max_length=4000)
    tmdb_rating: float | None = Field(default=None, ge=0, le=10)
    tmdb_release_year: int | None = Field(default=None, ge=1900, le=2100)


class TorrentResponse(BaseModel):
    id: int
    name: str
    magnet_link: str | None
    torrent_file_path: str | None
    category: TorrentCategoryLiteral
    category_id: int | None
    status: TorrentStatusLiteral
    progress: float
    download_speed: float | None
    upload_speed: float | None
    size_total: int | None
    size_downloaded: int | None
    eta_seconds: int | None
    save_path: str | None
    info_hash: str | None
    error_message: str | None
    no_seed: bool
    season_number: int | None
    episode_number: int | None
    tmdb_id: int | None
    tmdb_poster_url: str | None
    tmdb_overview: str | None
    tmdb_rating: float | None
    tmdb_release_year: int | None
    created_at: datetime
    updated_at: datetime | None


class TorrentFileItem(BaseModel):
    index: int
    path: str
    size: int
    progress: float


class TMDBResult(BaseModel):
    tmdb_id: int
    title: str
    original_title: str
    year: Optional[int]
    overview: str
    poster_url: Optional[str]
