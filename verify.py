import os
import subprocess

# Disk'teki segmentler
hls_dir = '/var/www/vod-manager/shared/hls/2/'
disk_segs = set(f for f in os.listdir(hls_dir) if f.endswith('.ts'))

# m3u8'deki segmentler
r = subprocess.run(['curl', '-s', 'http://localhost:8080/hls/2/stream.m3u8'], capture_output=True, text=True)
m3u8_segs = set(l.strip() for l in r.stdout.splitlines() if l.strip().endswith('.ts'))

overlap = disk_segs & m3u8_segs
missing = m3u8_segs - disk_segs

print(f"M3U8 segments: {len(m3u8_segs)}")
print(f"Disk segments: {len(disk_segs)}")
print(f"Overlap (available): {len(overlap)}")
print(f"Missing from disk: {len(missing)}")

if overlap:
    seg = sorted(overlap)[0]
    r2 = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', f'http://localhost:8080/hls/2/{seg}'], capture_output=True, text=True)
    print(f"\nHTTP test for {seg}: {r2.stdout}")
