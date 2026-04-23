from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="stopped")  # stopped, playing, paused
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="SET NULL"), nullable=True, index=True)
    current_item_index = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    total_duration_seconds = Column(Integer, nullable=False, default=0)
    loop = Column(Boolean, nullable=False, default=True)
    ffmpeg_pid = Column(Integer, nullable=True)
    stream_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    server = relationship("Server")
    items = relationship(
        "PlaylistItem",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistItem.position.asc()",
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    transcode_job_id = Column(Integer, ForeignKey("transcode_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    title = Column(String(255), nullable=False)
    duration_seconds = Column(Integer, nullable=False, default=0)
    file_path = Column(String(1000), nullable=False, default="")
    tmdb_id = Column(Integer, nullable=True)
    tmdb_title = Column(String(255), nullable=True)
    tmdb_overview = Column(Text, nullable=True)
    tmdb_poster_url = Column(String(1000), nullable=True)
    is_visible_in_category = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    playlist = relationship("Playlist", back_populates="items")
    transcode_job = relationship("TranscodeJob")
