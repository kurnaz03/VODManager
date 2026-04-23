c = open('backend/app/modules/stream/router.py').read()

old = (
    '            elif item_type == "vod_channel":\n'
    '                # VOD Channel (playlist) is a continuous HLS stream \u2014 treat like live\n'
    '                stream_url = f"{base}/live/{username}/{password}/{item.item_id}.ts"'
)
new = (
    '            elif item_type == "vod_channel":\n'
    '                # VOD Channel (playlist) is a continuous HLS stream \u2014 treat like live\n'
    '                stream_url = f"{base}/live/{username}/{password}/{item.item_id}"'
)

if old in c:
    c = c.replace(old, new)
    open('backend/app/modules/stream/router.py', 'w').write(c)
    print("OK: .ts removed from vod_channel url")
else:
    print("FAILED: pattern not matched")
    # debug: show hex around the spot
    import re
    m = re.search(r'vod_channel.{0,300}', c, re.S)
    if m:
        print(repr(m.group(0)[:300]))
