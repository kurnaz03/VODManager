# coding: utf-8
"""Fix update_user: bulk delete with synchronize_session=False"""

with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = "        db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete()"
new = "        db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete(synchronize_session='fetch')"

if old in content:
    content = content.replace(old, new)
    with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: update_user bouquet delete patched')
else:
    print('FAIL: pattern not found')
    idx = content.find('db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete')
    print(repr(content[idx:idx+200]) if idx >= 0 else 'not found at all')
