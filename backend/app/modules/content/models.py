import enum

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CategoryMixin:
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String(80), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_hidden = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MovieCategory(CategoryMixin, Base):
    __tablename__ = "movie_categories"


class SeriesCategory(CategoryMixin, Base):
    __tablename__ = "series_categories"


class TvCategory(CategoryMixin, Base):
    __tablename__ = "tv_categories"


class RadioCategory(CategoryMixin, Base):
    __tablename__ = "radio_categories"


class BouquetType(str, enum.Enum):
    mixed = "mixed"
    movies = "movies"
    series = "series"
    tv = "tv"
    radio = "radio"


class Bouquet(Base):
    __tablename__ = "bouquets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    bouquet_type = Column(Enum(BouquetType), nullable=False, default=BouquetType.mixed, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categories = relationship(
        "BouquetCategory",
        back_populates="bouquet",
        cascade="all, delete-orphan",
        order_by="BouquetCategory.sort_order.asc(), BouquetCategory.id.asc()",
    )
    items = relationship(
        "BouquetItem",
        back_populates="bouquet",
        cascade="all, delete-orphan",
        order_by="BouquetItem.position.asc(), BouquetItem.id.asc()",
    )


class BouquetCategory(Base):
    __tablename__ = "bouquet_categories"

    id = Column(Integer, primary_key=True, index=True)
    bouquet_id = Column(Integer, ForeignKey("bouquets.id", ondelete="CASCADE"), nullable=False, index=True)
    category_type = Column(String(20), nullable=False, index=True)
    category_id = Column(Integer, nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bouquet = relationship("Bouquet", back_populates="categories")


class BouquetItemType(str, enum.Enum):
    tv = "tv"
    series = "series"
    vod_channel = "vod_channel"
    radio = "radio"
    movie = "movie"


class BouquetItem(Base):
    __tablename__ = "bouquet_items"

    id = Column(Integer, primary_key=True, index=True)
    bouquet_id = Column(Integer, ForeignKey("bouquets.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(Enum(BouquetItemType), nullable=False, index=True)
    item_id = Column(Integer, nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bouquet = relationship("Bouquet", back_populates="items")


# ── Movies Content ────────────────────────────────────────────────────────────

class MovieContent(Base):
    __tablename__ = "movie_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("movie_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    tmdb_id = Column(Integer, nullable=True, index=True)
    poster_url = Column(String(1000), nullable=True)
    backdrop_url = Column(String(1000), nullable=True)
    release_year = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    resolution = Column(String(10), nullable=True)
    audio_bitrate = Column(Integer, nullable=True)
    file_path = Column(String(1000), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    source_url = Column(Text, nullable=True)
    is_public = Column(Boolean, nullable=False, default=True, index=True)
    download_queue_id = Column(Integer, ForeignKey("download_queue.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("MovieCategory")


# ── Series Content (Xtream Codes hierarchy) ──────────────────────────────────

class SeriesContent(Base):
    __tablename__ = "series_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("series_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    tmdb_id = Column(Integer, nullable=True, index=True)
    poster_url = Column(String(1000), nullable=True)
    backdrop_url = Column(String(1000), nullable=True)
    release_year = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    broadcast_day = Column(String(20), nullable=True, index=True)
    broadcast_channel = Column(String(100), nullable=True)
    channel_logo_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("SeriesCategory")
    seasons = relationship("SeriesSeason", back_populates="series", cascade="all, delete-orphan", order_by="SeriesSeason.season_number.asc()")


class SeriesSeason(Base):
    __tablename__ = "series_seasons"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series_contents.id", ondelete="CASCADE"), nullable=False, index=True)
    season_number = Column(Integer, nullable=False, default=1)
    title = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    series = relationship("SeriesContent", back_populates="seasons")
    episodes = relationship("SeriesEpisode", back_populates="season", cascade="all, delete-orphan", order_by="SeriesEpisode.episode_number.asc()")


class SeriesEpisode(Base):
    __tablename__ = "series_episodes"

    id = Column(Integer, primary_key=True, index=True)
    season_id = Column(Integer, ForeignKey("series_seasons.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_number = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=True)
    duration = Column(Integer, nullable=True)
    resolution = Column(String(10), nullable=True)
    audio_bitrate = Column(Integer, nullable=True)
    file_path = Column(String(1000), nullable=True)
    source_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    season = relationship("SeriesSeason", back_populates="episodes")


# ── TV Content ────────────────────────────────────────────────────────────────

class TvContent(Base):
    __tablename__ = "tv_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("tv_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    logo_url = Column(String(1000), nullable=True)
    stream_url = Column(Text, nullable=True)
    is_public = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("TvCategory")


# ── Radio Content ─────────────────────────────────────────────────────────────

class RadioContent(Base):
    __tablename__ = "radio_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("radio_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    logo_url = Column(String(1000), nullable=True)
    stream_url = Column(Text, nullable=True)
    is_public = Column(Boolean, nullable=False, default=True, index=True)
    visual_url = Column(String(1000), nullable=True)
    visual_type = Column(String(20), nullable=True, default="none")
    is_active = Column(Boolean, nullable=False, default=False, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="SET NULL"), nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ffmpeg_pid = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("RadioCategory")
    server = relationship("Server")


# ── Music Tracks ──────────────────────────────────────────────────────────────

class MusicTrack(Base):
    __tablename__ = "music_tracks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    file_path = Column(Text, nullable=True)
    stream_url = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("radio_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    cover_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("RadioCategory")


# ── Music Playlists ───────────────────────────────────────────────────────────

class MusicPlaylist(Base):
    __tablename__ = "music_playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    visual_url = Column(String(1000), nullable=True)
    visual_type = Column(String(20), nullable=True, default="none")
    is_active = Column(Boolean, nullable=False, default=False)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="SET NULL"), nullable=True, index=True)
    ffmpeg_pid = Column(Integer, nullable=True)
    stream_url = Column(String(1000), nullable=True)
    status = Column(String(20), nullable=False, default="stopped")
    started_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship(
        "MusicPlaylistItem",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="MusicPlaylistItem.position.asc(), MusicPlaylistItem.id.asc()",
    )


class MusicPlaylistItem(Base):
    __tablename__ = "music_playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("music_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(Integer, ForeignKey("music_tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)

    playlist = relationship("MusicPlaylist", back_populates="items")
    track = relationship("MusicTrack")
