#!/usr/bin/env python3
"""Test logo upload through nginx vs direct"""
import requests, io

base_direct = "http://127.0.0.1:8000/api/v1"
base_nginx = "http://62.210.92.252/api/v1"

# Login
r = requests.post(base_direct + "/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json()["access_token"]
auth = {"Authorization": "Bearer " + token}

# Create a minimal valid PNG in memory
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

# Test 1: Direct
r1 = requests.post(base_direct + "/transcode-profiles/1/logo",
    files={"file": ("test.png", io.BytesIO(png), "image/png")}, headers=auth)
print("Direct:", r1.status_code)

# Test 2: Nginx
r2 = requests.post(base_nginx + "/transcode-profiles/1/logo",
    files={"file": ("test.png", io.BytesIO(png), "image/png")}, headers=auth)
print("Nginx:", r2.status_code, r2.text[:300])
