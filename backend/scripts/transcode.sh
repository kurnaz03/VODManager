#!/bin/bash
FILES=(
  /var/www/vod-manager/shared/uploads/movies/series_5/00001.mp4
  /var/www/vod-manager/shared/uploads/movies/series_19/00002.mp4
  /var/www/vod-manager/shared/uploads/movies/series_20/00002.mp4
  /var/www/vod-manager/shared/uploads/movies/series_18/00001.mp4
)
rm -f /tmp/transcode.log
for f in "${FILES[@]}"; do
  echo "TRANSCODING $f" >> /tmp/transcode.log
  ffmpeg -y -i "$f" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${f}.tmp.mp4" 2>> /tmp/transcode.log
  if [ $? -eq 0 ]; then
    mv "${f}.tmp.mp4" "$f"
    echo "DONE $f" >> /tmp/transcode.log
  else
    rm -f "${f}.tmp.mp4"
    echo "FAILED $f" >> /tmp/transcode.log
  fi
done
echo "ALL_COMPLETE" >> /tmp/transcode.log
