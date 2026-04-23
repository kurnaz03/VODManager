# coding: utf-8
"""
Patch UsersPage.tsx:
1. ISP/Country only show for online users (active_connections > 0) + IP below
2. Remove M3uDropdown, replace with simple copy button
3. Remove m3uDropdownUser state and unused imports
"""

with open('/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# --- Fix 1: ISP/Country cell - show only when active_connections > 0, add IP below ---
old_isp = """                  {/* ISP / Country */}
                  <td className="px-3 py-2">
                    {u.last_country_code ? (
                      <span className="flex items-center gap-1 flex-wrap">
                        <img
                          src={`https://flagcdn.com/16x12/${u.last_country_code.toLowerCase()}.png`}
                          alt={u.last_country_code}
                          style={{ width: 16, height: 12 }}
                          className="inline-block shrink-0"
                        />
                        <span className="text-gray-600 font-mono">{u.last_country_code}</span>
                        {u.last_isp && (
                          <span className="text-gray-500 truncate max-w-[110px]" title={u.last_isp}>{u.last_isp}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>"""

new_isp = """                  {/* ISP / Country - sadece online kullanicilarda goster */}
                  <td className="px-3 py-2">
                    {activeConns > 0 && u.last_country_code ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 flex-wrap">
                          <img
                            src={`https://flagcdn.com/16x12/${u.last_country_code.toLowerCase()}.png`}
                            alt={u.last_country_code}
                            style={{ width: 16, height: 12 }}
                            className="inline-block shrink-0"
                          />
                          <span className="text-gray-600 font-mono">{u.last_country_code}</span>
                          {u.last_isp && (
                            <span className="text-gray-500 truncate max-w-[110px]" title={u.last_isp}>{u.last_isp}</span>
                          )}
                        </span>
                        {u.last_ip && (
                          <div className="text-xs text-gray-400 font-mono">{u.last_ip}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>"""

if old_isp in content:
    content = content.replace(old_isp, new_isp)
    print('OK: ISP cell patched')
else:
    print('FAIL: ISP cell pattern not found')

# --- Fix 2: Remove M3uDropdown usage in actions, replace with simple Download copy button ---
old_m3u_actions = """                      {/* Download M3U dropdown */}
                      <M3uDropdown
                        user={u}
                        open={m3uDropdownUser === u.id}
                        onToggle={() => setM3uDropdownUser(m3uDropdownUser === u.id ? null : u.id)}
                        onClose={() => setM3uDropdownUser(null)}
                        showToast={showToast}
                      />
                      {/* Copy M3U */}
                      <ActionBtn icon={<Link2 size={11} />} title="Copy M3U URL" color="text-indigo-500 hover:bg-indigo-100" onClick={() => copyM3u(u)} />"""

new_m3u_actions = """                      {/* Download M3U - tek tik kopyala */}
                      <ActionBtn icon={<Download size={11} />} title="M3U Plus URL Kopyala" color="text-cyan-600 hover:bg-cyan-100"
                        onClick={() => { navigator.clipboard.writeText(iptvUsersApi.m3uUrl(u, 'm3u_plus')); showToast('M3U Plus URL kopyalandi', 'ok') }} />"""

if old_m3u_actions in content:
    content = content.replace(old_m3u_actions, new_m3u_actions)
    print('OK: M3U actions patched')
else:
    print('FAIL: M3U actions pattern not found')

# --- Fix 3: Remove m3uDropdownUser state ---
old_state = "  const [m3uDropdownUser, setM3uDropdownUser] = useState<number | null>(null)\n"
new_state = ""
if old_state in content:
    content = content.replace(old_state, new_state)
    print('OK: m3uDropdownUser state removed')
else:
    print('WARN: m3uDropdownUser state not found (may already be removed)')

# --- Fix 4: Remove M3uDropdown component entirely ---
old_component = """
function M3uDropdown({
  user,
  open,
  onToggle,
  onClose,
  showToast,
}: {
  user: IptvUser
  open: boolean
  onToggle: () => void
  onClose: () => void
  showToast: (msg: string, type: 'ok' | 'err') => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open, onClose])

  const options: { label: string; fmt: 'm3u_plus' | 'm3u8' | 'enigma2_api'; toast: string }[] = [
    { label: 'M3U Plus URL', fmt: 'm3u_plus', toast: 'M3U Plus URL kopyalandi' },
    { label: 'M3U8 URL', fmt: 'm3u8', toast: 'M3U8 URL kopyalandi' },
    { label: 'Enigma2 API URL', fmt: 'enigma2_api', toast: 'Enigma2 API URL kopyalandi' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="M3U URLs"
        className="rounded p-1 transition text-cyan-600 hover:bg-cyan-100"
        onClick={onToggle}
      >
        <Download size={11} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-0.5 z-50 bg-white border border-gray-200 rounded shadow-lg py-1 w-44 text-xs">
          {options.map(({ label, fmt, toast }) => (
            <button
              key={fmt}
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 transition"
              onClick={() => {
                navigator.clipboard.writeText(iptvUsersApi.m3uUrl(user, fmt))
                showToast(toast, 'ok')
                onClose()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}"""

if old_component in content:
    content = content.replace(old_component, '')
    print('OK: M3uDropdown component removed')
else:
    print('FAIL: M3uDropdown component not found')

# --- Fix 5: Remove Link2 from imports (no longer needed) ---
old_import = "  Activity, BarChart2, ChevronDown, Circle, Download, Edit, Filter,\n  Link2, List, Loader2, Play, Plus, RefreshCw, Search, Shield,\n  Wifi, WifiOff, X, XCircle,"
new_import = "  Activity, BarChart2, ChevronDown, Circle, Download, Edit, Filter,\n  List, Loader2, Play, Plus, RefreshCw, Search, Shield,\n  Wifi, WifiOff, X, XCircle,"
if old_import in content:
    content = content.replace(old_import, new_import)
    print('OK: Link2 removed from imports')
else:
    print('WARN: Link2 import pattern not found')

# --- Fix 6: Remove copyM3u function (now inline) ---
old_copym3u = "  function copyM3u(u: IptvUser) { navigator.clipboard.writeText(iptvUsersApi.m3uUrl(u)); showToast('M3U URL kopyalandi', 'ok') }\n"
if old_copym3u in content:
    content = content.replace(old_copym3u, '')
    print('OK: copyM3u function removed')
else:
    print('WARN: copyM3u function not found (may be different)')

with open('/var/www/vod-manager/app/frontend/src/modules/users/pages/UsersPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('DONE: UsersPage.tsx saved')
