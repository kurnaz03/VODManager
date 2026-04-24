from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TvChannel(Base):
    __tablename__ = "tv_channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    logo_url = Column(String(1000), nullable=True)
    epg_channel_id = Column(String(255), nullable=True)
    stream_url = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey("tv_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("TvCategory")
    servers = relationship(
        "TvChannelServer",
        back_populates="channel",
        cascade="all, delete-orphan",
        order_by="TvChannelServer.priority.asc()",
    )
    bouquet_assignments = relationship(
        "TvChannelBouquet",
        back_populates="channel",
        cascade="all, delete-orphan",
    )


class TvChannelServer(Base):
    __tablename__ = "tv_channel_servers"

    id = Column(Integer, primary_key=True, index=True)
    tv_channel_id = Column(Integer, ForeignKey("tv_channels.id", ondelete="CASCADE"), nullable=False, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    priority = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    channel = relationship("TvChannel", back_populates="servers")
    server = relationship("Server")


class TvChannelBouquet(Base):
    __tablename__ = "tv_channel_bouquets"

    id = Column(Integer, primary_key=True, index=True)
    tv_channel_id = Column(Integer, ForeignKey("tv_channels.id", ondelete="CASCADE"), nullable=False, index=True)
    bouquet_id = Column(Integer, ForeignKey("bouquets.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    channel = relationship("TvChannel", back_populates="bouquet_assignments")
    bouquet = relationship("Bouquet")
