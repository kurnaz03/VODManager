from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


DownloadStatusLiteral = Literal["queued", "approved", "downloading", "completed", "failed", "cancelled"]
DownloadSourceTypeLiteral = Literal["url", "youtube", "m3u8"]
DownloadResolutionLiteral = Literal["2160", "1080", "720", "auto"]


class DownloadBasePayload(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    url: HttpUrl
    category_id: int | None = Field(default=None, ge=1)
    # 'movies' veya 'series' – varsayilan film indirmesi
    category_type: Literal["movies", "series"] = "movies"
    tmdb_id: int | None = Field(default=None, ge=1)
    tmdb_title: str | None = Field(default=None, max_length=255)
    tmdb_overview: str | None = Field(default=None, max_length=5000)
    tmdb_poster_url: str | None = Field(default=None, max_length=1000)
    tmdb_backdrop_url: str | None = Field(default=None, max_length=1000)
    tmdb_year: int | None = Field(default=None, ge=1800, le=2100)
    tmdb_rating: float | None = Field(default=None, ge=0, le=10)
    resolution: DownloadResolutionLiteral = "auto"
    vpn_client_id: int | None = Field(default=None, ge=1)
    # Dizi indirmesi icin ek alanlar – sadece category_type='series' oldugunda kullanilir
    series_id: int | None = Field(default=None, ge=1)
    season_id: int | None = Field(default=None, ge=1)
    episode_number: int | None = Field(default=None, ge=1)


class DownloadCreate(DownloadBasePayload):
    pass


class DownloadUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    category_id: int | None = Field(default=None, ge=1)
    tmdb_id: int | None = Field(default=None, ge=1)
    tmdb_title: str | None = Field(default=None, max_length=255)
    tmdb_overview: str | None = Field(default=None, max_length=5000)
    tmdb_poster_url: str | None = Field(default=None, max_length=1000)
    tmdb_backdrop_url: str | None = Field(default=None, max_length=1000)
    tmdb_year: int | None = Field(default=None, ge=1800, le=2100)
    tmdb_rating: float | None = Field(default=None, ge=0, le=10)
    resolution: DownloadResolutionLiteral | None = None


class DownloadResponse(BaseModel):
    id: int
    title: str
    url: str
    source_type: DownloadSourceTypeLiteral
    category_id: int | None = None
    category_type: str
    category_name: str | None
    tmdb_id: int | None
    tmdb_title: str | None
    tmdb_overview: str | None
    tmdb_poster_url: str | None
    tmdb_backdrop_url: str | None
    tmdb_year: int | None
    tmdb_rating: float | None
    resolution: DownloadResolutionLiteral
    file_number: int
    file_path: str | None
    file_size_bytes: int | None
    status: DownloadStatusLiteral
    progress_percent: int
    speed_mbps: float | None
    eta_seconds: int | None
    error_message: str | None
    vpn_client_id: int | None
    # Dizi indirmesine ait ek alanlar
    series_id: int | None
    season_id: int | None
    episode_number: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime | None


class DownloadSettingsResponse(BaseModel):
    max_concurrent_downloads: int
    max_download_speed_mbps: float
    default_download_directory: str


class DownloadSettingsUpdate(BaseModel):
    max_concurrent_downloads: int = Field(ge=1, le=5)
    max_download_speed_mbps: float = Field(ge=0, le=1000)


class TmdbMovieSearchItem(BaseModel):
    id: int
    title: str
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    release_year: int | None
    rating: float | None


class TmdbMovieDetailResponse(BaseModel):
    id: int
    title: str
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    release_year: int | None
    rating: float | None


class TmdbTvSearchItem(BaseModel):
    id: int
    title: str
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    first_air_year: int | None
    rating: float | None


class TmdbTvDetailResponse(BaseModel):
    id: int
    title: str
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    first_air_year: int | None
    rating: float | None
    number_of_seasons: int | None
    genres: list[str]