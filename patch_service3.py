# coding: utf-8
"""Fix update_user: remove db.add(user) and add db.flush() before new bouquets"""

with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    if payload.bouquet_ids is not None:
        db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete(synchronize_session='fetch')
        for bouquet_id in payload.bouquet_ids:
            bouquet = db.query(Bouquet).filter(Bouquet.id == bouquet_id).first()
            if bouquet:
                db.add(UserBouquet(user_id=user_id, bouquet_id=bouquet_id))

    db.add(user)
    db.commit()"""

new = """    db.flush()

    if payload.bouquet_ids is not None:
        db.query(UserBouquet).filter(UserBouquet.user_id == user_id).delete(synchronize_session='fetch')
        db.flush()
        for bouquet_id in payload.bouquet_ids:
            bouquet = db.query(Bouquet).filter(Bouquet.id == bouquet_id).first()
            if bouquet:
                db.add(UserBouquet(user_id=user_id, bouquet_id=bouquet_id))

    db.commit()"""

if old in content:
    content = content.replace(old, new)
    with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: update_user db.add(user) fix applied')
else:
    print('FAIL: pattern not found')
    idx = content.find('db.add(user)')
    print(repr(content[max(0,idx-200):idx+200]) if idx >= 0 else 'db.add(user) not found')
