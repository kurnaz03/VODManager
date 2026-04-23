from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ThemeSettingsResponse(BaseModel):
    panel_name: str
    logo_url: str | None
    primary_color: str
    sidebar_color: str
    accent_color: str


class ThemeSettingsUpdate(BaseModel):
    panel_name: str = Field(min_length=2, max_length=80)
    primary_color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    sidebar_color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    accent_color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class TmdbSettingsResponse(BaseModel):
    api_key_masked: str | None
    has_api_key: bool
    language: str


class TmdbSettingsUpdate(BaseModel):
    api_key: str | None = Field(default=None, max_length=255)
    language: str = Field(min_length=2, max_length=10)


class TmdbTestResponse(BaseModel):
    success: bool
    message: str
    language: str
    sample_title: str | None


class YoutubeLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=255)


class YoutubeManualCookiesRequest(BaseModel):
    cookies_text: str = Field(min_length=20)


class YoutubeSettingsResponse(BaseModel):
    email: str | None
    mode: str | None
    status: str
    last_refresh_at: datetime | None
    next_refresh_at: datetime | None
    error_message: str | None
    cookies_available: bool
    has_credentials: bool
    updated_at: datetime | None
    message: str | None = None