SELECT id, name, video_codec, video_bitrate, video_width, video_height, video_fps, video_gop_size, sc_threshold, audio_codec, audio_bitrate, audio_sample_rate, audio_channels 
FROM transcode_profiles 
WHERE name = 'VOD Channel (HLS Ready)';
