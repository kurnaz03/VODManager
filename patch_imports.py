# coding: utf-8
"""Fix unused imports: remove useEffect and useRef"""

with open('/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "import { useState, useEffect, useRef } from 'react'"
new = "import { useState } from 'react'"

if old in content:
    content = content.replace(old, new)
    with open('/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: unused imports removed')
else:
    print('FAIL: import line not found')
    idx = content.find("import { useState")
    print(repr(content[idx:idx+100]))
