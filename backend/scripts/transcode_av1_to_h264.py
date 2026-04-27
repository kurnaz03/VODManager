#!/usr/bin/env python3
"""
Transcode AV1/Opus files in series_episodes to H264/AAC.
Queries DB for file_path entries, checks codec with ffprobe,
and transcodes only AV1 or Opus files using ffmpeg.
"""

import subprocess
import sys
import os
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Adjust this if needed
DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/vodmanager")


def get_file_paths():
    try:
        import psycopg2
    except ImportError:
        log.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, file_path FROM series_episodes WHERE file_path IS NOT NULL AND file_path != ''")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def get_codecs(file_path):
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        file_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        video_codec = None
        audio_codec = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video" and not video_codec:
                video_codec = stream.get("codec_name", "").lower()
            if stream.get("codec_type") == "audio" and not audio_codec:
                audio_codec = stream.get("codec_name", "").lower()
        return video_codec, audio_codec
    except Exception as e:
        log.warning(f"ffprobe failed for {file_path}: {e}")
        return None, None


def transcode_file(file_path):
    tmp_path = file_path + ".transcoding.mp4"
    cmd = [
        "ffmpeg", "-i", file_path,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "128k",
        "-y",
        tmp_path
    ]
    log.info(f"Transcoding: {file_path}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if result.returncode != 0:
        log.error(f"ffmpeg failed for {file_path}:\n{result.stderr[-2000:]}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return False

    # Replace original
    os.replace(tmp_path, file_path)
    log.info(f"Done: {file_path}")
    return True


def main():
    rows = get_file_paths()
    log.info(f"Found {len(rows)} series_episodes with file_path")

    transcoded = 0
    skipped = 0
    errors = 0

    for episode_id, file_path in rows:
        if not os.path.exists(file_path):
            log.warning(f"Episode {episode_id}: file not found: {file_path}")
            skipped += 1
            continue

        video_codec, audio_codec = get_codecs(file_path)
        log.debug(f"Episode {episode_id}: video={video_codec} audio={audio_codec} path={file_path}")

        needs_transcode = (
            (video_codec and "av1" in video_codec) or
            (audio_codec and "opus" in audio_codec)
        )

        if not needs_transcode:
            log.info(f"Episode {episode_id}: OK (video={video_codec}, audio={audio_codec}), skipping")
            skipped += 1
            continue

        log.info(f"Episode {episode_id}: needs transcode (video={video_codec}, audio={audio_codec})")
        success = transcode_file(file_path)
        if success:
            transcoded += 1
        else:
            errors += 1

    log.info(f"Summary: transcoded={transcoded}, skipped={skipped}, errors={errors}")


if __name__ == "__main__":
    main()
