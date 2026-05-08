UPDATE transcode_jobs SET status='failed', error_message='zombie job - worker restart' WHERE id IN (176, 178) AND status='transcoding';
SELECT id, status, error_message FROM transcode_jobs WHERE id IN (176, 178);
