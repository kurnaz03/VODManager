import re
c = open('backend/app/modules/stream/router.py').read()
m = re.search(r'vod_channel.{0,200}\.ts', c, re.S)
if m:
    print(repr(m.group(0)))
else:
    print("not found")
    # show lines around vod_channel
    for i, line in enumerate(c.splitlines()):
        if 'vod_channel' in line:
            print(f"line {i}: {repr(line)}")
