SELECT 
  pi.playlist_id,
  p.name,
  pi.id,
  pi.transcode_job_id,
  tj.transcode_profile_id
FROM playlist_items pi
JOIN playlists p ON pi.playlist_id = p.id
LEFT JOIN transcode_jobs tj ON pi.transcode_job_id = tj.id
WHERE p.status != 'stopped'
ORDER BY pi.playlist_id, pi.position;
