import subprocess
import re

# M3u8 al
r = subprocess.run(['curl', '-s', 'http://localhost:8080/hls/2/stream.m3u8'], capture_output=True, text=True)
print("=== stream.m3u8 ===")
print(r.stdout[:300])

# Segmentleri bul
segs = [l.strip() for l in r.stdout.splitlines() if l.strip().endswith('.ts')]
print(f"\nSegments in m3u8: {len(segs)}")
if segs:
    seg = segs[0]
    print(f"Testing: {seg}")
    r2 = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', f'http://localhost:8080/hls/2/{seg}'], capture_output=True, text=True)
    print(f"HTTP: {r2.stdout}")

# Disk segment sayisi
import os
hls_dir = '/var/www/vod-manager/shared/hls/2/'
ts_files = [f for f in os.listdir(hls_dir) if f.endswith('.ts')]
print(f"\nDisk ts files: {len(ts_files)}")
print("Latest:", sorted(ts_files)[-3:])

# /live/ endpoint m3u8 test
r3 = subprocess.run(['curl', '-s', 'http://localhost:8080/live/gkhan/k0x20glnzp51/2.ts'], capture_output=True, text=True)
print("\n=== /live/ m3u8 first 5 lines ===")
lines = r3.stdout.splitlines()[:6]
for l in lines: print(l)

# /live/ segment test
urls = [l.strip() for l in r3.stdout.splitlines() if l.strip().startswith('http')]
if urls:
    url = urls[0]
    print(f"\nTesting URL: {url}")
    r4 = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', url], capture_output=True, text=True)
    print(f"HTTP: {r4.stdout}")
