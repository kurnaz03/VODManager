SELECT id, name, hardware_accel, hwaccel_type, video_codec, video_preset, video_bitrate, video_width, video_height, video_profile, video_level FROM transcode_profiles WHERE id IN (19, 20);
SELECT id, name, ip_address, server_type, status, cpu_info FROM servers ORDER BY id;
