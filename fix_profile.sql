UPDATE transcode_profiles SET hardware_accel = NULL, video_preset = 'ultrafast' WHERE id = 20;
UPDATE transcode_jobs SET status = 'queued', server_id = NULL, error_message = NULL, started_at = NULL WHERE id = 262;
SELECT id, name, hardware_accel, video_preset FROM transcode_profiles WHERE id = 20;
