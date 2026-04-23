# coding: utf-8
with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    if all_user_ids:
        # T\u00fcm kullan\u0131c\u0131lar i\u00e7in en son ba\u011flant\u0131y\u0131 al (is_active veya son bilinen)
        all_conns = (
            db.query(UserConnection)
            .filter(
                UserConnection.user_id.in_(all_user_ids),
            )
            .order_by(UserConnection.user_id, UserConnection.last_seen_at.desc())
            .all()
        )
        seen: set[int] = set()
        for c in all_conns:
            if c.user_id not in seen:
                isp_map[c.user_id] = (c.ip_address, c.isp_name, c.country_code)
                seen.add(c.user_id)"""

new = """    if all_user_ids:
        # Sadece aktif baglantılardan ISP/ulke bilgisini al (is_active=True + 120s tolerans)
        isp_threshold = datetime.now(timezone.utc) - timedelta(seconds=120)
        all_conns = (
            db.query(UserConnection)
            .filter(
                UserConnection.user_id.in_(all_user_ids),
                UserConnection.is_active == True,
                UserConnection.last_seen_at >= isp_threshold,
            )
            .order_by(UserConnection.user_id, UserConnection.last_seen_at.desc())
            .all()
        )
        seen: set[int] = set()
        for c in all_conns:
            if c.user_id not in seen:
                isp_map[c.user_id] = (c.ip_address, c.isp_name, c.country_code)
                seen.add(c.user_id)"""

if old in content:
    content = content.replace(old, new)
    with open('/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: service.py patched')
else:
    print('FAIL: pattern not found')
    idx = content.find('if all_user_ids:')
    print(repr(content[idx:idx+600]))
