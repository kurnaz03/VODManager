import subprocess

# /live/ endpoint'ten m3u8 al ve segmentleri hemen test et
r = subprocess.run(['curl', '-s', 'http://localhost:8080/live/gkhan/k0x20glnzp51/2.ts'], capture_output=True, text=True)
urls = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('http')]

print(f"Segments in /live/ m3u8: {len(urls)}")
results = []
for url in urls[:5]:
    seg = url.split('/')[-1]
    r2 = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', url], capture_output=True, text=True)
    results.append((seg, r2.stdout))
    print(f"  {seg}: HTTP {r2.stdout}")

ok = sum(1 for _, code in results if code == '200')
print(f"\nResult: {ok}/{len(results)} segments OK")
