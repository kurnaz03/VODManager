#!/usr/bin/env python3
"""Fix frontend: show ISP/Country whenever last_country_code is available (not only when active)"""

path = '/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_isp_condition = '{activeConns > 0 && u.last_country_code ? ('
new_isp_condition = '{u.last_country_code ? ('

if old_isp_condition in content:
    content = content.replace(old_isp_condition, new_isp_condition)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: ISP/Country condition updated (shows for all users with known data)')
else:
    print('NOT FOUND:', old_isp_condition)
    idx = content.find('last_country_code')
    print('Context:', content[idx-100:idx+200])
