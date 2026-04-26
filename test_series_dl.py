#!/usr/bin/env python3
import requests, json

base = "http://127.0.0.1:8000/api/v1"
r = requests.post(base + "/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json()["access_token"]
auth = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}

# Test series download create
payload = {
    "url": "https://www.youtube.com/watch?v=JraNFP78WE8",
    "title": "Test Dizi Bolum",
    "category_type": "series",
    "category_id": None,
    "series_id": 1,
    "season_id": 1,
    "episode_number": 1,
    "resolution": "1080",
    "source_type": "youtube",
}
r2 = requests.post(base + "/downloads", json=payload, headers=auth)
print(f"Status: {r2.status_code}")
print(f"Response: {r2.text}")
