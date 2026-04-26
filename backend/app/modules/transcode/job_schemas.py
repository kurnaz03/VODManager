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

    # Yazi kenar boslugu (padding)
    text_padding_top: int = Field(default=0, ge=0, le=500)
    text_padding_bottom: int = Field(default=0, ge=0, le=500)

    # Yazi gorunme/kaybolma efekti (fade in/out)
    text_fade_enabled: bool = False
    # Kac saniyede bir dongu (ornek 600 = 10 dakika)
    text_fade_interval: int = Field(default=600, ge=1)
    # Kac saniye gizli kalacak
    text_fade_duration: int = Field(default=20, ge=1)
    # Belirme suresi (saniye)
    text_fade_in_time: int = Field(default=3, ge=1)
    # Kaybolma suresi (saniye)
    text_fade_out_time: int = Field(default=3, ge=1)

    countdown_enabled: bool = False
    countdown_position: str = "top-right"


class TranscodeJobUpdate(BaseModel):
    overlay_text: str | None = None
    text_position: str | None = None
    text_size: int | None = Field(default=None, ge=6, le=200)
    text_color: str | None = None
    text_bg_enabled: bool | None = None
    text_bg_color: str | None = None

    # Yazi kenar boslugu (padding) guncelleme
    text_padding_top: int | None = Field(default=None, ge=0, le=500)
    text_padding_bottom: int | None = Field(default=None, ge=0, le=500)

    # Fade efekti guncelleme
    text_fade_enabled: bool | None = None
    text_fade_interval: int | None = Field(default=None, ge=1)
    text_fade_duration: int | None = Field(default=None, ge=1)
    text_fade_in_time: int | None = Field(default=None, ge=1)
    text_fade_out_time: int | None = Field(default=None, ge=1)

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

    # Yazi kenar boslugu
    text_padding_top: int
    text_padding_bottom: int

    # Fade efekti
    text_fade_enabled: bool
    text_fade_interval: int
    text_fade_duration: int
    text_fade_in_time: int
    text_fade_out_time: int

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
