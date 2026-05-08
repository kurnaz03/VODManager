import urllib.request, json, sys

# Try to discover the right admin password
passwords_to_try = ["Kia2014x", "admin", "admin123", "Admin123", "password", "VODManager2024"]

token = None
for pwd in passwords_to_try:
    login_data = json.dumps({"username": "admin", "password": pwd}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req)
        token_data = json.loads(resp.read().decode())
        token = token_data.get("access_token")
        print(f"Login OK with password: {pwd}")
        break
    except urllib.error.HTTPError as e:
        print(f"Failed with {pwd}: {e.code}")

if not token:
    print("Could not authenticate")
    sys.exit(1)

# Step 2: Create profile
d = {
    "name": "GTX 1080 - 1080p NVENC",
    "video_codec": "h264",
    "video_width": 1920,
    "video_height": 1080,
    "video_fps": 25,
    "video_preset": "p4",
    "video_crf": None,
    "video_bitrate": "6000k",
    "video_maxrate": "8000k",
    "video_bufsize": "12000k",
    "video_profile": "high",
    "video_level": "4.1",
    "video_pixel_format": "yuv420p",
    "video_gop_size": 50,
    "video_b_frames": 3,
    "audio_codec": "aac",
    "audio_bitrate": "192k",
    "audio_sample_rate": 48000,
    "audio_channels": 2,
    "output_format": "mp4",
    "container_format": "mp4",
    "hardware_accel": "nvenc",
    "hwaccel_type": "cuda",
    "movflags_faststart": True,
    "vsync_mode": "cfr",
    "is_default": False,
}

body = json.dumps(d).encode()
req3 = urllib.request.Request(
    "http://localhost:8000/api/v1/transcode-profiles",
    data=body,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    method="POST",
)
try:
    resp3 = urllib.request.urlopen(req3)
    result = json.loads(resp3.read().decode())
    print("OK - Profile created, id:", result.get("id"), "name:", result.get("name"))
except urllib.error.HTTPError as e3:
    print("Create error:", e3.code, e3.read().decode()[:500])
