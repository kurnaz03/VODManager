from datetime import datetime

from pydantic import BaseModel


class PlaylistCreate(BaseModel):
    name: str
    description: str | None = None
    server_id: int | None = None
    loop: bool = True


class PlaylistUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    server_id: int | None = None
    loop: bool | None = None
    status: str | None = None


class PlaylistItemAdd(BaseModel):
    transcode_job_id: int


class PlaylistItemReorder(BaseModel):
    item_ids: list[int]


class PlaylistItemResponse(BaseModel):
    id: int
    playlist_id: int
    transcode_job_id: int
    position: int
    title: str
    duration_seconds: int
    file_path: str
    tmdb_id: int | None
    tmdb_title: str | None
    tmdb_overview: str | None
    tmdb_poster_url: str | None
    is_visible_in_category: bool
    created_at: datetime


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    server_id: int | None
    server_name: str | None
    current_item_index: int
    started_at: datetime | None
    total_duration_seconds: int
    loop: bool
    ffmpeg_pid: int | None = None
    stream_url: str | None = None
    item_count: int
    created_at: datetime
    updated_at: datetime | None
    items: list[PlaylistItemResponse] = []


class BroadcastStatusResponse(BaseModel):
    playlist_id: int
    status: str
    ffmpeg_pid: int | None
    stream_url: str | None
    started_at: datetime | None
    elapsed_seconds: int
    current_item_index: int
    current_title: str | None
    is_running: bool
