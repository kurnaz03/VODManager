#!/usr/bin/env python3
import requests, sys, json

base = "http://127.0.0.1:8000"

# Login - try /api/v1/auth/login
payload = json.dumps({"username": "admin", "password": "admin123"})
r = requests.post(
    base + "/api/v1/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"}
)
print("Login status:", r.status_code)
if r.status_code != 200:
    print("Body:", r.text[:300])
    sys.exit(1)

token = r.json()["access_token"]
auth = {"Authorization": "Bearer " + token}

# Upload a real existing logo
logo = "/var/www/vod-manager/shared/uploads/channel-logos/profile_1_dea87cea140e4046ad38385dc4ece9d4.png"
with open(logo, "rb") as f:
    r2 = requests.post(
        base + "/api/v1/transcode-profiles/1/logo",
        files={"file": ("logo.png", f, "image/png")},
        headers=auth
    )
print("Logo upload:", r2.status_code)
print("Response:", r2.text[:500])
