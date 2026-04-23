from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TranscodeProfile(Base):
    __tablename__ = "transcode_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)

    # Logo
    logo_path = Column(String(500), nullable=True)
    logo_width = Column(Integer, nullable=True)
    logo_height = Column(Integer, nullable=True)
    logo_position = Column(String(20), nullable=False, default="top-right")
    logo_opacity = Column(Float, nullable=False, default=1.0)
    logo_margin_x = Column(Integer, nullable=False, default=10)
    logo_margin_y = Column(Integer, nullable=False, default=10)

    # Video
    video_codec = Column(String(20), nullable=False, default="h264")
    video_bitrate = Column(String(20), nullable=True)
    video_maxrate = Column(String(20), nullable=True)
    video_bufsize = Column(String(20), nullable=True)
    video_crf = Column(Integer, nullable=True, default=18)
    video_width = Column(Integer, nullable=True)
    video_height = Column(Integer, nullable=True)
    video_fps = Column(Float, nullable=True)
    video_profile = Column(String(20), nullable=True)
    video_level = Column(String(10), nullable=True)
    video_preset = Column(String(20), nullable=True, default="medium")
    video_tune = Column(String(30), nullable=True)
    video_pixel_format = Column(String(20), nullable=False, default="yuv420p")
    video_gop_size = Column(Integer, nullable=True)
    video_b_frames = Column(Integer, nullable=True)
    video_reference_frames = Column(Integer, nullable=True)
    deinterlace = Column(Boolean, nullable=False, default=False)
    deinterlace_mode = Column(String(20), nullable=False, default="yadif")
    scaling_algorithm = Column(String(20), nullable=False, default="lanczos")
    sc_threshold = Column(Integer, nullable=False, default=0)

    # Audio
    audio_codec = Column(String(20), nullable=False, default="aac")
    audio_bitrate = Column(String(20), nullable=True)
    audio_sample_rate = Column(Integer, nullable=True, default=48000)
    audio_channels = Column(Integer, nullable=True, default=2)
    audio_volume = Column(Float, nullable=False, default=1.0)
    audio_normalization = Column(Boolean, nullable=False, default=False)
    async_audio_sync = Column(Integer, nullable=True, default=1)

    # Container / Format
    output_format = Column(String(10), nullable=False, default="mp4")
    output_type = Column(String(30), nullable=False, default="channel_ready")
    container_format = Column(String(10), nullable=False, default="mp4")
    muxer_flags = Column(String(255), nullable=True)
    segment_duration = Column(Integer, nullable=True)

    # Sync / Timestamp flags
    vsync_mode = Column(String(20), nullable=False, default="cfr")
    avoid_negative_ts = Column(String(20), nullable=False, default="make_zero")
    fflags_mode = Column(String(50), nullable=False, default="+genpts")
    thread_queue_size = Column(Integer, nullable=False, default=512)

    # Advanced
    hardware_accel = Column(String(20), nullable=True)
    hwaccel_type = Column(String(20), nullable=True)
    extra_ffmpeg_args = Column(Text, nullable=True)
    x264_params = Column(String(500), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)

    # Audio mapping & processing
    audio_map = Column(String(20), nullable=False, default="first")  # first | all | custom
    audio_map_channel = Column(Integer, nullable=True)  # custom channel index
    audio_normalize = Column(Boolean, nullable=False, default=False)

    # Container flags
    movflags_faststart = Column(Boolean, nullable=False, default=True)
    map_metadata = Column(Boolean, nullable=False, default=False)

    # Hidden category reference (movie_categories)
    hidden_category_id = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TranscodeJob(Base):
    __tablename__ = "transcode_jobs"

    id = Column(Integer, primary_key=True, index=True)
    movie_content_id = Column(
        Integer, ForeignKey("movie_contents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transcode_profile_id = Column(
        Integer, ForeignKey("transcode_profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    server_id = Column(
        Integer, ForeignKey("servers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    source_file_path = Column(String(1000), nullable=False)
    output_file_path = Column(String(1000), nullable=True)
    unique_number = Column(Integer, nullable=False, unique=True, index=True)

    # Overlay text
    overlay_text = Column(String(500), nullable=True)
    text_position = Column(String(20), nullable=False, default="bottom-right")
    text_size = Column(Integer, nullable=False, default=24)
    text_color = Column(String(10), nullable=False, default="#FFFFFF")
    text_bg_enabled = Column(Boolean, nullable=False, default=False)
    text_bg_color = Column(String(10), nullable=False, default="#000000")

    # Countdown
    countdown_enabled = Column(Boolean, nullable=False, default=False)
    countdown_position = Column(String(20), nullable=False, default="top-right")

    # Status & progress
    status = Column(String(20), nullable=False, default="queued", index=True)
    progress = Column(Float, nullable=False, default=0.0)
    eta_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    movie_content = relationship("MovieContent")
    transcode_profile = relationship("TranscodeProfile")
    server = relationship("Server")
