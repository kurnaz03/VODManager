from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserConnection(Base):
    __tablename__ = "user_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("iptv_users.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False)
    isp_name = Column(String(255), nullable=True)
    country_code = Column(String(5), nullable=True)
    country_name = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    stream_id = Column(Integer, nullable=True)
    stream_type = Column(String(20), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    user = relationship("IptvUser", backref="connections")


class UserWatchHistory(Base):
    __tablename__ = "user_watch_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("iptv_users.id", ondelete="CASCADE"), nullable=False, index=True)
    stream_id = Column(Integer, nullable=True)
    stream_name = Column(String(255), nullable=True)
    stream_type = Column(String(20), nullable=True)
    ip_address = Column(String(45), nullable=True)
    country_code = Column(String(5), nullable=True)
    isp_name = Column(String(255), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    user = relationship("IptvUser", backref="watch_history")
