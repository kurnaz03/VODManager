from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "VOD Manager"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production-super-secret-key-at-least-32-chars"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://voduser:vodpassword@localhost:5432/vodmanager"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://voduser:vodpassword@localhost:5432/vodmanager"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_SETUP: str = "3/minute"
    SSH_TIMEOUT_SECONDS: int = 10
    COMMAND_TIMEOUT_SECONDS: int = 120
    METRICS_RETENTION_HOURS: int = 24

    # Server management
    FERNET_KEY: str | None = None
    MAIN_SERVER_NAME: str = "Main Server"
    MAIN_SERVER_IP: str = "62.210.92.252"
    MAIN_SERVER_SSH_PORT: int = 22
    MAIN_SERVER_SSH_USERNAME: str = "root"
    MAIN_SERVER_SSH_PASSWORD: str = ""
    SHARED_STORAGE_ROOT: str = str(PROJECT_ROOT / "storage")

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def shared_storage_path(self) -> Path:
        return Path(self.SHARED_STORAGE_ROOT)

    @property
    def logos_path(self) -> Path:
        return self.shared_storage_path / "uploads" / "logos"

    @property
    def youtube_cookies_path(self) -> Path:
        return self.shared_storage_path / "cookies" / "youtube_cookies.txt"

    @property
    def movies_uploads_path(self) -> Path:
        return self.shared_storage_path / "uploads" / "movies"


settings = Settings()
