from datetime import datetime

from pydantic import BaseModel, Field


TextPositionLiteral = str  # top-left, top-right, bottom-left, bottom-right, center, center-bottom, center-top
CountdownPositionLiteral = str  # top-left, top-right, bottom-left, bottom-right


class TranscodeJobCreate(BaseModel):
    movie_content_id: int
    transcode_profile_id: int
    server_id: int | None = None
    overlay_text: str | None = None
    text_position: str = "bottom-right"
    text_size: int = Field(default=24, ge=6, le=200)
    text_color: str = "#FFFFFF"
    text_bg_enabled: bool = False
    text_bg_color: str = "#000000"
    countdown_enabled: bool = False
    countdown_position: str = "top-right"


class TranscodeJobUpdate(BaseModel):
    overlay_text: str | None = None
    text_position: str | None = None
    text_size: int | None = Field(default=None, ge=6, le=200)
    text_color: str | None = None
    text_bg_enabled: bool | None = None
    text_bg_color: str | None = None
    countdown_enabled: bool | None = None
    countdown_position: str | None = None
    server_id: int | None = None


class TranscodeJobResponse(BaseModel):
    id: int
    movie_content_id: int
    movie_title: str | None
    movie_file_path: str | None
    transcode_profile_id: int
    profile_name: str | None
    server_id: int | None
    server_name: str | None
    source_file_path: str
    output_file_path: str | None
    unique_number: int
    overlay_text: str | None
    text_position: str
    text_size: int
    text_color: str
    text_bg_enabled: bool
    text_bg_color: str
    countdown_enabled: bool
    countdown_position: str
    status: str
    progress: float
    eta_seconds: int | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime | None
