import enum

from sqlalchemy import BigInteger, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class TorrentCategory(str, enum.Enum):
    movie = "movie"
    series = "series"


class TorrentStatus(str, enum.Enum):
    downloading = "downloading"
    seeding = "seeding"
    completed = "completed"
    paused = "paused"
    error = "error"
    queued = "queued"


class TorrentDownload(Base):
    __tablename__ = "torrent_downloads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False, index=True)
    magnet_link = Column(Text, nullable=True)
    torrent_file_path = Column(String(1000), nullable=True)
    category = Column(Enum(TorrentCategory), nullable=False, index=True)
    category_id = Column(Integer, nullable=True, index=True)
    status = Column(Enum(TorrentStatus), nullable=False, default=TorrentStatus.queued, index=True)
    progress = Column(Float, nullable=False, default=0.0)
    download_speed = Column(Float, nullable=True)
    upload_speed = Column(Float, nullable=True)
    size_total = Column(BigInteger, nullable=True)
    size_downloaded = Column(BigInteger, nullable=True)
    eta_seconds = Column(Integer, nullable=True)
    save_path = Column(String(1000), nullable=True)
    info_hash = Column(String(100), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
