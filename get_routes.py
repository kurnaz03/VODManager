import subprocess
import json

# API routes al
result = subprocess.run(['curl', '-s', 'http://localhost:8000/openapi.json'], capture_output=True, text=True)
try:
    data = json.loads(result.stdout)
    paths = list(data.get('paths', {}).keys())
    for p in paths:
        if any(k in p.lower() for k in ['stream', 'broadcast', 'channel', 'playlist', 'live']):
            print(p)
except:
    print("Failed to parse:", result.stdout[:500])
