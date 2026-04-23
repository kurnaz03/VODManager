import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class IptvUser(Base):
    __tablename__ = "iptv_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(100), nullable=False)
    owner = Column(String(100), nullable=False, default="admin", index=True)
    max_connections = Column(Integer, nullable=False, default=1)
    is_trial = Column(Boolean, nullable=False, default=False)
    is_enabled = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    reseller_notes = Column(Text, nullable=True)

    # Advanced
    forced_connection = Column(String(20), nullable=False, default="disabled")
    is_restreamer = Column(Boolean, nullable=False, default=False)
    forced_country = Column(String(10), nullable=True)
    isp_lock_info = Column(String(255), nullable=True)
    access_hls = Column(Boolean, nullable=False, default=True)
    access_mpegts = Column(Boolean, nullable=False, default=True)
    access_rtmp = Column(Boolean, nullable=False, default=True)

    # Restrictions (JSON arrays stored as text)
    allowed_ips = Column(Text, nullable=True)
    allowed_user_agents = Column(Text, nullable=True)

    bouquets = relationship(
        "UserBouquet",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserBouquet(Base):
    __tablename__ = "user_bouquets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("iptv_users.id", ondelete="CASCADE"), nullable=False, index=True)
    bouquet_id = Column(Integer, ForeignKey("bouquets.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("IptvUser", back_populates="bouquets")
    bouquet = relationship("Bouquet")
