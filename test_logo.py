import requests, sys

base = "http://127.0.0.1:8000/api/v1"

# Login
r = requests.post(base + "/auth/login", json={"username": "admin", "password": "admin123"})
print("Login:", r.status_code, r.text[:200])
data = r.json()
token = data.get("access_token") or data.get("token")
if not token:
    sys.exit(1)
headers = {"Authorization": "Bearer " + token}

# Test logo upload with a real image
logo_path = "/var/www/vod-manager/shared/uploads/channel-logos/profile_1_dea87cea140e4046ad38385dc4ece9d4.png"
with open(logo_path, "rb") as f:
    files = {"file": ("test.png", f, "image/png")}
    r = requests.post(base + "/transcode-profiles/1/logo", files=files, headers=headers)
    print("Upload:", r.status_code, r.text[:500])
