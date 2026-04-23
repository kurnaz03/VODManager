with open('/var/www/vod-manager/app/backend/app/modules/playlist/broadcast.py', 'r') as f:
    content = f.read()

old = '"-hls_list_size", "10"'
new = '"-hls_list_size", "30"'

if old in content:
    content = content.replace(old, new)
    with open('/var/www/vod-manager/app/backend/app/modules/playlist/broadcast.py', 'w') as f:
        f.write(content)
    print('REPLACED hls_list_size 10 -> 30')
else:
    print('NOT FOUND')
