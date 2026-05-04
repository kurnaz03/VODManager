from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

LogoPositionLiteral = Literal["top-left", "top-right", "bottom-left", "bottom-right", "center"]
VideoCodecLiteral = Literal["h264", "h265", "vp9", "av1"]
VideoPresetLiteral = Literal["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow", "p1", "p2", "p3", "p4", "p5", "p6", "p7"]
VideoTuneLiteral = Literal["film", "animation", "grain", "stillimage", "fastdecode", "zerolatency"]
VideoPixelFormatLiteral = Literal["yuv420p", "yuv422p", "yuv444p"]
VideoProfileLiteral = Literal["baseline", "main", "high"]
VideoLevelLiteral = Literal["3.0", "3.1", "4.0", "4.1", "4.2", "5.0", "5.1"]
ScalingAlgorithmLiteral = Literal["lanczos", "bicubic", "bilinear", "spline"]
AudioCodecLiteral = Literal["aac", "ac3", "eac3", "mp3", "opus", "flac"]
OutputFormatLiteral = Literal["mp4", "ts", "mkv", "flv"]
HardwareAccelLiteral = Literal["none", "nvenc", "vaapi", "qsv"]
VsyncModeLiteral = Literal["cfr", "vfr", "passthrough"]
AvoidNegativeTsLiteral = Literal["make_zero", "make_non_negative", "disabled"]
OutputTypeLiteral = Literal["channel_ready", "archive", "streaming_ready"]
ContainerFormatLiteral = Literal["mp4", "mkv", "mpegts"]
HwaccelTypeLiteral = Literal["cuda", "vaapi", "qsv", "none"]
DeinterlaceModeLiteral = Literal["yadif", "w3fdif", "bwdif"]

AudioMapLiteral = Literal["first", "all", "custom"]


class TranscodeProfileCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)

    # Logo
    logo_width: int | None = None
    logo_height: int | None = None
    logo_position: LogoPositionLiteral = "top-right"
    logo_opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    logo_margin_x: int = 10
    logo_margin_y: int = 10

    # Video
    video_codec: VideoCodecLiteral = "h264"
    video_bitrate: str | None = None
    video_maxrate: str | None = None
    video_bufsize: str | None = None
    video_crf: int | None = Field(default=18, ge=0, le=51)
    video_width: int | None = None
    video_height: int | None = None
    video_fps: float | None = 25.0
    video_profile: VideoProfileLiteral | None = "high"
    video_level: VideoLevelLiteral | None = "4.1"
    video_preset: VideoPresetLiteral | None = "medium"
    video_tune: VideoTuneLiteral | None = None
    video_pixel_format: VideoPixelFormatLiteral = "yuv420p"
    video_gop_size: int | None = Field(default=50, ge=1)
    video_b_frames: int | None = Field(default=3, ge=0, le=16)
    video_reference_frames: int | None = Field(default=None, ge=1)
    deinterlace: bool = False
    deinterlace_mode: DeinterlaceModeLiteral = "yadif"
    scaling_algorithm: ScalingAlgorithmLiteral = "lanczos"
    sc_threshold: int = 0

    # Audio
    audio_codec: AudioCodecLiteral = "aac"
    audio_bitrate: str | None = None
    audio_sample_rate: int | None = 48000
    audio_channels: int | None = 2
    audio_volume: float = Field(default=1.0, ge=0.0, le=10.0)
    audio_normalization: bool = False
    async_audio_sync: int | None = 1
    audio_map: AudioMapLiteral = "first"
    audio_map_channel: int | None = None
    audio_normalize: bool = False

    # Container
    output_format: OutputFormatLiteral = "mp4"
    output_type: OutputTypeLiteral = "channel_ready"
    container_format: ContainerFormatLiteral = "mp4"
    muxer_flags: str | None = None
    segment_duration: int | None = Field(default=None, ge=1)
    movflags_faststart: bool = True
    map_metadata: bool = False

    # Sync / Timestamp flags
    vsync_mode: VsyncModeLiteral = "cfr"
    avoid_negative_ts: AvoidNegativeTsLiteral = "make_zero"
    fflags_mode: str = "+genpts"
    thread_queue_size: int = 512

    # Advanced
    hardware_accel: HardwareAccelLiteral | None = None
    hwaccel_type: HwaccelTypeLiteral | None = None
    extra_ffmpeg_args: str | None = None
    x264_params: str | None = None
    is_default: bool = False


class TranscodeProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)

    logo_width: int | None = None
    logo_height: int | None = None
    logo_position: LogoPositionLiteral | None = None
    logo_opacity: float | None = Field(default=None, ge=0.0, le=1.0)
    logo_margin_x: int | None = None
    logo_margin_y: int | None = None

    video_codec: VideoCodecLiteral | None = None
    video_bitrate: str | None = None
    video_maxrate: str | None = None
    video_bufsize: str | None = None
    video_crf: int | None = Field(default=None, ge=0, le=51)
    video_width: int | None = None
    video_height: int | None = None
    video_fps: float | None = None
    video_profile: VideoProfileLiteral | None = None
    video_level: VideoLevelLiteral | None = None
    video_preset: VideoPresetLiteral | None = None
    video_tune: VideoTuneLiteral | None = None
    video_pixel_format: VideoPixelFormatLiteral | None = None
    video_gop_size: int | None = Field(default=None, ge=1)
    video_b_frames: int | None = Field(default=None, ge=0, le=16)
    video_reference_frames: int | None = Field(default=None, ge=1)
    deinterlace: bool | None = None
    deinterlace_mode: DeinterlaceModeLiteral | None = None
    scaling_algorithm: ScalingAlgorithmLiteral | None = None
    sc_threshold: int | None = None

    audio_codec: AudioCodecLiteral | None = None
    audio_bitrate: str | None = None
    audio_sample_rate: int | None = None
    audio_channels: int | None = None
    audio_volume: float | None = Field(default=None, ge=0.0, le=10.0)
    audio_normalization: bool | None = None
    async_audio_sync: int | None = None
    audio_map: AudioMapLiteral | None = None
    audio_map_channel: int | None = None
    audio_normalize: bool | None = None

    output_format: OutputFormatLiteral | None = None
    output_type: OutputTypeLiteral | None = None
    container_format: ContainerFormatLiteral | None = None
    muxer_flags: str | None = None
    segment_duration: int | None = Field(default=None, ge=1)
    movflags_faststart: bool | None = None
    map_metadata: bool | None = None

    vsync_mode: VsyncModeLiteral | None = None
    avoid_negative_ts: AvoidNegativeTsLiteral | None = None
    fflags_mode: str | None = None
    thread_queue_size: int | None = None

    hardware_accel: HardwareAccelLiteral | None = None
    hwaccel_type: HwaccelTypeLiteral | None = None
    extra_ffmpeg_args: str | None = None
    x264_params: str | None = None
    is_default: bool | None = None


class TranscodeProfileResponse(BaseModel):
    id: int
    name: str

    logo_path: str | None
    logo_url: str | None
    logo_width: int | None
    logo_height: int | None
    logo_position: str
    logo_opacity: float
    logo_margin_x: int
    logo_margin_y: int

    video_codec: str
    video_bitrate: str | None
    video_maxrate: str | None
    video_bufsize: str | None
    video_crf: int | None
    video_width: int | None
    video_height: int | None
    video_fps: float | None
    video_profile: str | None
    video_level: str | None
    video_preset: str | None
    video_tune: str | None
    video_pixel_format: str
    video_gop_size: int | None
    video_b_frames: int | None
    video_reference_frames: int | None
    deinterlace: bool
    deinterlace_mode: str
    scaling_algorithm: str
    sc_threshold: int

    audio_codec: str
    audio_bitrate: str | None
    audio_sample_rate: int | None
    audio_channels: int | None
    audio_volume: float
    audio_normalization: bool
    async_audio_sync: int | None
    audio_map: str
    audio_map_channel: int | None
    audio_normalize: bool

    output_format: str
    output_type: str
    container_format: str
    muxer_flags: str | None
    segment_duration: int | None
    movflags_faststart: bool
    map_metadata: bool

    vsync_mode: str
    avoid_negative_ts: str
    fflags_mode: str
    thread_queue_size: int

    hardware_accel: str | None
    hwaccel_type: str | None
    extra_ffmpeg_args: str | None
    x264_params: str | None
    is_default: bool

    hidden_category_id: int | None
    created_at: datetime
    updated_at: datetime | None
