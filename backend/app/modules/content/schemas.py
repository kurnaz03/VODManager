from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CategoryTypeLiteral = Literal["movies", "series", "tv", "radio"]
BouquetTypeLiteral = Literal["mixed", "movies", "series", "tv", "radio"]
BouquetItemTypeLiteral = Literal["tv", "series", "vod_channel", "radio", "movie"]


class CategoryBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    icon: str | None = Field(default=None, max_length=80)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    icon: str | None = Field(default=None, max_length=80)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class BouquetBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    bouquet_type: BouquetTypeLiteral = "mixed"
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)


class BouquetCreate(BouquetBase):
    pass


class BouquetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    bouquet_type: BouquetTypeLiteral | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class BouquetCategoryCreate(BaseModel):
    category_type: CategoryTypeLiteral
    category_id: int = Field(ge=1)
    sort_order: int = Field(default=0, ge=0)


class BouquetCategoriesBulkUpdate(BaseModel):
    categories: list[BouquetCategoryCreate]


class BouquetCategoryResponse(BaseModel):
    id: int
    category_type: CategoryTypeLiteral
    category_id: int
    sort_order: int
    category_name: str
    category_description: str | None
    icon: str | None
    is_active: bool
    created_at: datetime


class BouquetResponse(BaseModel):
    id: int
    name: str
    description: str | None
    bouquet_type: BouquetTypeLiteral
    is_active: bool
    sort_order: int
    category_count: int
    item_count: int
    created_at: datetime
    updated_at: datetime | None


class BouquetDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    bouquet_type: BouquetTypeLiteral
    is_active: bool
    sort_order: int
    categories: list[BouquetCategoryResponse]
    created_at: datetime
    updated_at: datetime | None


class BouquetItemCreate(BaseModel):
    item_type: BouquetItemTypeLiteral
    item_id: int = Field(ge=1)
    position: int = Field(default=0, ge=0)


class BouquetItemBulkCreate(BaseModel):
    items: list[BouquetItemCreate]


class BouquetItemResponse(BaseModel):
    id: int
    bouquet_id: int
    item_type: BouquetItemTypeLiteral
    item_id: int
    position: int
    item_title: str | None
    item_logo: str | None
    created_at: datetime


# ── Movie Content Schemas ─────────────────────────────────────────────────────

class MovieContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    tmdb_id: int | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    release_year: int | None = None
    rating: float | None = None
    resolution: str | None = None
    audio_bitrate: int | None = None
    file_path: str | None = None
    source_url: str | None = None
    is_public: bool = True


class MovieContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    poster_url: str | None = None
    is_public: bool | None = None


class MovieContentResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category_id: int | None
    category_name: str | None
    tmdb_id: int | None
    poster_url: str | None
    backdrop_url: str | None
    release_year: int | None
    rating: float | None
    resolution: str | None
    audio_bitrate: int | None
    file_path: str | None
    file_size_bytes: int | None
    source_url: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime


# ── Series Content Schemas ────────────────────────────────────────────────────

BROADCAST_DAYS = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"]


class SeriesContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    tmdb_id: int | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    release_year: int | None = None
    rating: float | None = None
    broadcast_day: str | None = None
    broadcast_channel: str | None = None
    channel_logo_url: str | None = None


class SeriesContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    poster_url: str | None = None
    broadcast_day: str | None = None
    broadcast_channel: str | None = None
    channel_logo_url: str | None = None


class SeriesContentResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category_id: int | None
    category_name: str | None
    tmdb_id: int | None
    poster_url: str | None
    backdrop_url: str | None
    release_year: int | None
    rating: float | None
    season_count: int
    broadcast_day: str | None
    broadcast_channel: str | None
    channel_logo_url: str | None
    created_at: datetime
    updated_at: datetime


class SeasonCreate(BaseModel):
    season_number: int = Field(ge=1)
    title: str | None = None


class SeasonResponse(BaseModel):
    id: int
    series_id: int
    season_number: int
    title: str | None
    episode_count: int
    created_at: datetime


class EpisodeCreate(BaseModel):
    episode_number: int = Field(ge=1)
    title: str | None = None
    duration: int | None = None
    resolution: str | None = None
    audio_bitrate: int | None = None
    file_path: str | None = None
    source_url: str | None = None


class EpisodeUpdate(BaseModel):
    title: str | None = None
    duration: int | None = None
    resolution: str | None = None
    audio_bitrate: int | None = None
    file_path: str | None = None
    source_url: str | None = None


class EpisodeResponse(BaseModel):
    id: int
    season_id: int
    episode_number: int
    title: str | None
    duration: int | None
    resolution: str | None
    audio_bitrate: int | None
    file_path: str | None
    source_url: str | None
    created_at: datetime


# ── TV / Radio Content Schemas ────────────────────────────────────────────────

class StreamContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    logo_url: str | None = None
    stream_url: str | None = None
    is_public: bool = True


class StreamContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category_id: int | None = None
    logo_url: str | None = None
    stream_url: str | None = None
    is_public: bool | None = None


class StreamContentResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category_id: int | None
    category_name: str | None
    logo_url: str | None
    stream_url: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime

