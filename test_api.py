import urllib.request, json
req = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=json.dumps({"username":"admin","password":"admin"}).encode(),
    headers={"Content-Type":"application/json"}
)
resp = json.loads(urllib.request.urlopen(req).read())
token = resp.get("access_token","NOT_FOUND")
print("TOKEN:", token[:80])
req2 = urllib.request.Request(
    "http://localhost:8000/api/v1/playlists/2",
    headers={"Authorization": "Bearer " + token}
)
data = json.loads(urllib.request.urlopen(req2).read())
print("STATUS:", data.get("status"))
print("ITEM_COUNT:", data.get("item_count"))
print("ITEMS_LEN:", len(data.get("items",[])))
if data.get("items"):
    print("FIRST_ITEM_TITLE:", data["items"][0].get("title"))
