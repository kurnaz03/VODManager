from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class VpnClient(Base):
    __tablename__ = "vpn_clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=True, index=True)
    cert_path = Column(String(500), nullable=True)
    key_path = Column(String(500), nullable=True)
    ovpn_path = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class VpnServerConfig(Base):
    __tablename__ = "vpn_server_config"

    id = Column(Integer, primary_key=True, index=True)
    server_ip = Column(String(100), nullable=False, default="62.210.92.252")
    server_port = Column(Integer, nullable=False, default=1194)
    protocol = Column(String(10), nullable=False, default="udp")
    ca_cert_path = Column(String(500), nullable=False, default="/etc/openvpn/easy-rsa/pki/ca.crt")
    server_cert_path = Column(String(500), nullable=False, default="/etc/openvpn/easy-rsa/pki/issued/server.crt")
    server_key_path = Column(String(500), nullable=False, default="/etc/openvpn/easy-rsa/pki/private/server.key")
    dh_params_path = Column(String(500), nullable=False, default="/etc/openvpn/easy-rsa/pki/dh.pem")
    ta_key_path = Column(String(500), nullable=False, default="/etc/openvpn/ta.key")
    easy_rsa_dir = Column(String(500), nullable=False, default="/etc/openvpn/easy-rsa")
    clients_dir = Column(String(500), nullable=False, default="/etc/openvpn/clients")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
