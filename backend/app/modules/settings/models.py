import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class YoutubeCookieStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    error = "error"


class YoutubeCookieCredential(Base):
    __tablename__ = "youtube_cookies"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_encrypted = Column(Text, nullable=False)
    cookies_json = Column(Text, nullable=True)
    cookies_file_path = Column(String(500), nullable=True)
    last_refresh_at = Column(DateTime(timezone=True), nullable=True)
    next_refresh_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(YoutubeCookieStatus), nullable=False, default=YoutubeCookieStatus.error, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())