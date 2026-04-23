import enum

from sqlalchemy import BigInteger, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DownloadSourceType(str, enum.Enum):
    url = "url"
    youtube = "youtube"
    m3u8 = "m3u8"


class DownloadStatus(str, enum.Enum):
    queued = "queued"
    approved = "approved"
    downloading = "downloading"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class DownloadQueue(Base):
    __tablename__ = "download_queue"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    url = Column(Text, nullable=False)
    source_type = Column(Enum(DownloadSourceType), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("movie_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    category_type = Column(String(20), nullable=False, default="movies", index=True)
    tmdb_id = Column(Integer, nullable=True, index=True)
    tmdb_title = Column(String(255), nullable=True)
    tmdb_overview = Column(Text, nullable=True)
    tmdb_poster_url = Column(String(1000), nullable=True)
    tmdb_backdrop_url = Column(String(1000), nullable=True)
    tmdb_year = Column(Integer, nullable=True)
    tmdb_rating = Column(Float, nullable=True)
    resolution = Column(String(10), nullable=False, default="auto")
    file_number = Column(Integer, nullable=False, unique=True, index=True)
    file_path = Column(String(1000), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    status = Column(Enum(DownloadStatus), nullable=False, default=DownloadStatus.queued, index=True)
    progress_percent = Column(Integer, nullable=False, default=0)
    speed_mbps = Column(Float, nullable=True)
    eta_seconds = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    vpn_client_id = Column(Integer, ForeignKey("vpn_clients.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("MovieCategory")