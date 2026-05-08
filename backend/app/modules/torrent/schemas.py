from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


TorrentCategoryLiteral = Literal["movie", "series"]
TorrentStatusLiteral = Literal["downloading", "seeding", "completed", "paused", "error", "queued"]


class TorrentAddRequest(BaseModel):
    magnet_link: str = Field(min_length=10)
    name: str | None = Field(default=None, max_length=500)
    category: TorrentCategoryLiteral
    category_id: int | None = Field(default=None, ge=1)


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
    created_at: datetime
    updated_at: datetime | None


class TorrentFileItem(BaseModel):
    index: int
    path: str
    size: int
    progress: float
