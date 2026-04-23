#!/usr/bin/env python3
"""
Fix 1: M3U dropdown - change mousedown outside-click to click to prevent
       dropdown closing before option button click fires.
Fix 2: UserFormModal owner field - change text input to dropdown with admin users.
"""
import re, sys

# ─── Fix 1: M3U Dropdown ──────────────────────────────────────────────────────
users_page_path = '/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx'
with open(users_page_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change 'mousedown' to 'click' in the M3uDropdown outside-click handler
old_mousedown = """    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)"""

new_mousedown = """    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)"""

if old_mousedown in content:
    content = content.replace(old_mousedown, new_mousedown)
    print('Fix 1 (M3U dropdown mousedown->click): SUCCESS')
else:
    print('Fix 1: block not found, trying alternative...')
    if "document.addEventListener('mousedown', handleClick)" in content:
        content = content.replace(
            "document.addEventListener('mousedown', handleClick)",
            "document.addEventListener('click', handleClick)"
        )
        content = content.replace(
            "document.removeEventListener('mousedown', handleClick)",
            "document.removeEventListener('click', handleClick)"
        )
        print('Fix 1 (M3U dropdown): SUCCESS via simple replace')
    else:
        print('Fix 1 FAILED: mousedown not found')

with open(users_page_path, 'w', encoding='utf-8') as f:
    f.write(content)

# ─── Fix 2: UserFormModal - owner text input -> dropdown ─────────────────────
modal_path = '/var/www/vod-manager/app/frontend/src/modules/users/pages/UserFormModal.tsx'
with open(modal_path, 'r', encoding='utf-8') as f:
    modal = f.read()

# 1. Add import for authApi and AdminUser interface at the top
old_import_line = "import { contentApi } from '../../content/services/contentApi'"
new_import_lines = """import { contentApi } from '../../content/services/contentApi'
import api from '../../../utils/api'"""

if old_import_line in modal and "import api from '../../../utils/api'" not in modal:
    modal = modal.replace(old_import_line, new_import_lines)
    print('Fix 2a (add api import): SUCCESS')
else:
    print('Fix 2a: already present or not found, skipping')

# 2. Add adminUsersQuery after the existing bouquetsQ query
old_bouquets_q = "  const bouquetsQ = useQuery({ queryKey: ['bouquets'], queryFn: contentApi.listBouquets })"
new_bouquets_q = """  const bouquetsQ = useQuery({ queryKey: ['bouquets'], queryFn: contentApi.listBouquets })

  const adminUsersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await api.get<{ id: number; username: string }[]>('/auth/users')
      return r.data
    },
  })"""

if old_bouquets_q in modal and 'adminUsersQ' not in modal:
    modal = modal.replace(old_bouquets_q, new_bouquets_q)
    print('Fix 2b (add adminUsersQ): SUCCESS')
else:
    print('Fix 2b: already present or not found, skipping')

# 3. Replace the owner text input with a select dropdown
old_owner_input = """                <div>
                  <label className="panel-label">Sahip (Owner)</label>
                  <input className="panel-input" value={owner} onChange={e => setOwner(e.target.value)} />
                </div>"""

new_owner_select = """                <div>
                  <label className="panel-label">Sahip (Owner)</label>
                  <select
                    className="panel-select"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                  >
                    {(adminUsersQ.data ?? []).map(u => (
                      <option key={u.id} value={u.username}>{u.username}</option>
                    ))}
                    {/* Fallback: if current owner not in list, add it */}
                    {owner && !(adminUsersQ.data ?? []).some(u => u.username === owner) && (
                      <option value={owner}>{owner}</option>
                    )}
                  </select>
                </div>"""

if old_owner_input in modal:
    modal = modal.replace(old_owner_input, new_owner_select)
    print('Fix 2c (owner dropdown): SUCCESS')
else:
    print('Fix 2c FAILED: owner input block not found')
    # Debug: find it
    idx = modal.find("Sahip (Owner)")
    if idx >= 0:
        print(repr(modal[idx-50:idx+200]))

with open(modal_path, 'w', encoding='utf-8') as f:
    f.write(modal)

print('All fixes applied.')
