UPDATE transcode_profiles SET hwaccel_type = NULL WHERE id = 20;
UPDATE transcode_jobs SET status = 'queued', server_id = NULL, error_message = NULL, started_at = NULL WHERE id = 262;
SELECT id, name, hardware_accel, hwaccel_type FROM transcode_profiles WHERE id = 20;
