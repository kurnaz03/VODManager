#!/usr/bin/env python3
"""Fix: ISP/Country -- also fetch last known connection (not only active ones)"""

import re

path = '/var/www/vod-manager/app/backend/app/modules/iptv_users/service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = '''    # En son aktif bağlantının ISP/ülke bilgisini al (her kullanıcı için ilk aktif bağlantı)
    active_user_ids = list(conn_map.keys())
    isp_map: dict[int, tuple[str | None, str | None, str | None]] = {}
    if active_user_ids:
        # Subquery: her user için en son aktif bağlantının id\'si
        from sqlalchemy import and_
        active_conns = (
            db.query(UserConnection)
            .filter(
                UserConnection.is_active == True,
                UserConnection.last_seen_at >= expire_threshold,
                UserConnection.user_id.in_(active_user_ids),
            )
            .order_by(UserConnection.user_id, UserConnection.last_seen_at.desc())
            .all()
        )
        seen: set[int] = set()
        for c in active_conns:
            if c.user_id not in seen:
                isp_map[c.user_id] = (c.ip_address, c.isp_name, c.country_code)
                seen.add(c.user_id)'''

new_block = '''    # En son bağlantının ISP/ülke bilgisini al (aktif veya son bağlantı)
    # Önce aktif bağlantılardan al, yoksa son bilinen bağlantıdan al
    all_user_ids = [u.id for u in users]
    isp_map: dict[int, tuple[str | None, str | None, str | None]] = {}
    if all_user_ids:
        # Tüm kullanıcılar için en son bağlantıyı al (is_active veya son bilinen)
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
                seen.add(c.user_id)'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: service.py patched')
else:
    # Try to find the section with a flexible search
    print('ERROR: exact block not found, searching...')
    idx = content.find('active_user_ids = list(conn_map.keys())')
    if idx >= 0:
        print(f'Found at index {idx}')
        print(repr(content[idx-200:idx+500]))
    else:
        print('Not found at all')
