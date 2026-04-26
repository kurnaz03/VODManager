import requests, sys

base = "http://127.0.0.1:8000/api/v1"

# Login
r = requests.post(base + "/auth/login", json={"username": "admin", "password": "admin123"})
print("Login:", r.status_code)
if r.status_code != 200:
    # Try form login
    r = requests.post(base + "/auth/login", data={"username": "admin", "password": "admin123"})
    print("Login form:", r.status_code)
data = r.json()
token = data.get("access_token")
if not token:
    print("No token:", data)
    sys.exit(1)
headers = {"Authorization": "Bearer " + token}

# Create a small test PNG (1x1 pixel)
import struct, zlib
def make_png():
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    raw = b'\x00\x00\x00\x00'
    idat_data = zlib.compress(raw)
    idat_crc = zlib.crc32(b'IDAT' + idat_data) & 0xffffffff
    idat = struct.pack('>I', len(idat_data)) + b'IDAT' + idat_data + struct.pack('>I', idat_crc)
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    return sig + ihdr + idat + iend

png = make_png()
print("PNG size:", len(png))

# Test 1: Direct upload with explicit content_type
files = {"file": ("test.png", png, "image/png")}
r = requests.post(base + "/transcode-profiles/1/logo", files=files, headers=headers)
print("Test1 (image/png):", r.status_code, r.text[:300])

# Test 2: Upload without content_type
files2 = {"file": ("test.png", png)}
r2 = requests.post(base + "/transcode-profiles/1/logo", files=files2, headers=headers)
print("Test2 (no ct):", r2.status_code, r2.text[:300])

# Test 3: Upload with application/octet-stream
files3 = {"file": ("test.png", png, "application/octet-stream")}
r3 = requests.post(base + "/transcode-profiles/1/logo", files=files3, headers=headers)
print("Test3 (octet):", r3.status_code, r3.text[:300])
