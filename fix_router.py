content = open('backend/app/modules/stream/router.py').read()

# 1) vod_channel satirindaki .ts'yi kaldir
old = ('            elif item_type == "vod_channel":\n'
       '                # VOD Channel (playlist) is a continuous HLS stream \xe2\x80\x94 treat like live\n'
       '                stream_url = f\'{base}/live/{username}/{password}/{item.item_id}.ts\'')
new = ('            elif item_type == "vod_channel":\n'
       '                # VOD Channel (playlist) is a continuous HLS stream \xe2\x80\x94 treat like live\n'
       '                stream_url = f\'{base}/live/{username}/{password}/{item.item_id}\'')

if old in content:
    content = content.replace(old, new)
    print("Step 1 OK: .ts removed from vod_channel")
else:
    # try with -- instead of em dash
    old2 = ('            elif item_type == "vod_channel":\n'
            '                # VOD Channel (playlist) is a continuous HLS stream -- treat like live\n'
            '                stream_url = f\'{base}/live/{username}/{password}/{item.item_id}.ts\'')
    new2 = ('            elif item_type == "vod_channel":\n'
            '                # VOD Channel (playlist) is a continuous HLS stream -- treat like live\n'
            '                stream_url = f\'{base}/live/{username}/{password}/{item.item_id}\'')
    if old2 in content:
        content = content.replace(old2, new2)
        print("Step 1 OK (-- dash): .ts removed from vod_channel")
    else:
        print("Step 1 FAILED: pattern not found")

# 2) .ts route'undan once uzantisiz route decorator'u ekle
old_route = '@router.get("/live/{username}/{password}/{item_id}.ts", tags=["stream"])\ndef serve_live('
new_route = '@router.get("/live/{username}/{password}/{item_id}", tags=["stream"])\n@router.get("/live/{username}/{password}/{item_id}.ts", tags=["stream"])\ndef serve_live('

if old_route in content:
    content = content.replace(old_route, new_route)
    print("Step 2 OK: extensionless route added")
else:
    print("Step 2 FAILED: route pattern not found")

open('backend/app/modules/stream/router.py', 'w').write(content)
print("File written.")
