import urllib.request
import urllib.error
import json

# Login
login_data = json.dumps({"username": "admin", "password": "Kia2014x"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req) as resp:
        login_result = json.load(resp)
        print("Login:", list(login_result.keys()))
        token = login_result.get("access_token", "")
except urllib.error.HTTPError as e:
    print("Login error:", e.code, e.read().decode()[:200])
    exit(1)

# Get now-playing
req2 = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/playlists/now-playing",
    headers={"Authorization": f"Bearer {token}"}
)
try:
    with urllib.request.urlopen(req2) as resp:
        result = json.load(resp)
        print("Now-playing count:", len(result))
        for ch in result[:3]:
            print(" -", ch.get("playlist_name"), "status:", ch.get("status"))
except urllib.error.HTTPError as e:
    print("Now-playing error:", e.code, e.read().decode()[:500])
