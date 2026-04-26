#!/usr/bin/env python3
import http.client
import json

# Login first
conn = http.client.HTTPConnection("127.0.0.1", 8000)
login_body = json.dumps({"username": "admin", "password": "admin123"})
conn.request("POST", "/api/v1/auth/login", body=login_body, headers={"Content-Type": "application/json"})
resp = conn.getresponse()
print("Login:", resp.status)
data = json.loads(resp.read())
if "access_token" not in data:
    print(data)
    # Try with different credentials
    conn2 = http.client.HTTPConnection("127.0.0.1", 8000)
    # Check what users exist first
    print("Trying to find working credentials...")
    exit(1)

token = data["access_token"]

# Now upload logo using raw HTTP to see exactly what happens
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
png_data = open("/var/www/vod-manager/shared/uploads/channel-logos/profile_1_dea87cea140e4046ad38385dc4ece9d4.png", "rb").read()[:1024]  # first 1KB

body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test.png"\r\n'
    f"Content-Type: image/png\r\n\r\n"
).encode() + png_data + f"\r\n--{boundary}--\r\n".encode()

conn3 = http.client.HTTPConnection("127.0.0.1", 8000)
conn3.request("POST", "/api/v1/transcode-profiles/1/logo", body=body, headers={
    "Content-Type": f"multipart/form-data; boundary={boundary}",
    "Authorization": f"Bearer {token}"
})
resp3 = conn3.getresponse()
print("Upload:", resp3.status)
print("Body:", resp3.read().decode()[:500])
