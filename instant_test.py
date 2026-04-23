import subprocess
import time

start = time.time()

# m3u8 al - cok hizli
r = subprocess.run(['curl', '-s', 'http://localhost:8080/live/gkhan/k0x20glnzp51/2.ts'], capture_output=True, text=True, timeout=2)

elapsed = time.time() - start
print(f"M3U8 fetch: {elapsed:.3f}s")

urls = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('http')]
print(f"Segments: {len(urls)}")

if urls:
    # En son segment (en guncele en yakin)
    url = urls[-1]
    seg = url.split('/')[-1]
    print(f"Testing LAST segment: {seg}")
    
    r2 = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', url], capture_output=True, text=True, timeout=2)
    print(f"HTTP: {r2.stdout}")
    
    # Disk kontrol
    import os
    disk_path = f'/var/www/vod-manager/shared/hls/2/{seg}'
    print(f"On disk: {os.path.exists(disk_path)}")
    
    # Tum segleri hizlica test et
    import concurrent.futures
    def test_url(u):
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', u], capture_output=True, text=True, timeout=1)
        return r.stdout
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        codes = list(ex.map(test_url, urls[:10]))
    print(f"\nFirst 10 segments: {codes}")
    ok = codes.count('200')
    print(f"OK: {ok}/10")
