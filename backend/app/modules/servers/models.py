import enum
from sqlalchemy import BigInteger, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ServerType(str, enum.Enum):
    main = "main"
    loadbalancer = "loadbalancer"


class ServerStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    installing = "installing"
    error = "error"


class InstallStepStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    ip_address = Column(String(45), unique=True, nullable=False, index=True)
    ssh_port = Column(Integer, nullable=False, default=22)
    ssh_username = Column(String(120), nullable=False)
    ssh_password = Column(Text, nullable=False)
    server_type = Column(Enum(ServerType), nullable=False, default=ServerType.loadbalancer, index=True)
    status = Column(Enum(ServerStatus), nullable=False, default=ServerStatus.offline, index=True)
    os_info = Column(String(255), nullable=True)
    cpu_info = Column(String(255), nullable=True)
    ram_total = Column(BigInteger, nullable=True)
    disk_total = Column(BigInteger, nullable=True)
    domain_name = Column(String(255), nullable=True)
    max_clients = Column(Integer, nullable=True)
    network_interface = Column(String(64), nullable=True)
    network_speed = Column(Integer, nullable=True, default=1000)
    http_port = Column(Integer, nullable=True, default=8080)
    https_port = Column(Integer, nullable=True, default=8443)
    rtmp_port = Column(Integer, nullable=True, default=25462)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    metrics = relationship("ServerMetric", back_populates="server", cascade="all, delete-orphan")
    install_logs = relationship("ServerInstallLog", back_populates="server", cascade="all, delete-orphan")


class ServerMetric(Base):
    __tablename__ = "server_metrics"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    cpu_percent = Column(Float, nullable=False, default=0)
    ram_percent = Column(Float, nullable=False, default=0)
    ram_used = Column(BigInteger, nullable=False, default=0)
    disk_percent = Column(Float, nullable=False, default=0)
    disk_used = Column(BigInteger, nullable=False, default=0)
    network_in_mbps = Column(Float, nullable=False, default=0)
    network_out_mbps = Column(Float, nullable=False, default=0)
    active_connections = Column(Integer, nullable=False, default=0)
    network_rx_bytes = Column(BigInteger, nullable=False, default=0)
    network_tx_bytes = Column(BigInteger, nullable=False, default=0)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    server = relationship("Server", back_populates="metrics")


class ServerInstallLog(Base):
    __tablename__ = "server_install_logs"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    step = Column(String(120), nullable=False)
    status = Column(Enum(InstallStepStatus), nullable=False, default=InstallStepStatus.pending)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    server = relationship("Server", back_populates="install_logs")