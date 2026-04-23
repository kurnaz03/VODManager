import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Copy, Download, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { contentApi } from '../../content/services/contentApi'
import api from '../../../utils/api'
import { iptvUsersApi, IptvUser, IptvUserCreatePayload } from '../services/iptvUsersApi'

interface Props {
  editUser: IptvUser | null
  onClose: () => void
  onSaved: () => void
  onError: () => void
}

type TabKey = 'details' | 'advanced' | 'restrictions' | 'bouquets'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'details', label: '1. Detaylar' },
  { key: 'advanced', label: '2. Gelismis' },
  { key: 'restrictions', label: '3. Kisitlamalar' },
  { key: 'bouquets', label: '4. Bouquets' },
]
const TAB_ORDER: TabKey[] = ['details', 'advanced', 'restrictions', 'bouquets']

const COUNTRIES = [
  'TR', 'US', 'DE', 'GB', 'FR', 'NL', 'BE', 'AT', 'CH', 'IT', 'ES', 'PL', 'RU', 'UA',
  'SA', 'AE', 'EG', 'MA', 'DZ', 'TN', 'IQ', 'SY', 'LB', 'JO', 'KW', 'QA', 'BH', 'OM',
  'AU', 'CA', 'JP', 'KR', 'CN', 'IN', 'BR', 'MX', 'SE', 'DK', 'NO', 'FI',
]

export default function UserFormModal({ editUser, onClose, onSaved, onError }: Props) {
  const isEdit = editUser != null
  const [tab, setTab] = useState<TabKey>('details')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [owner, setOwner] = useState('admin')
  const [maxConn, setMaxConn] = useState(1)
  const [isTrial, setIsTrial] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [expiryDate, setExpiryDate] = useState('')
  const [neverExpires, setNeverExpires] = useState(true)
  const [adminNotes, setAdminNotes] = useState('')
  const [resellerNotes, setResellerNotes] = useState('')
  const [m3uFmt, setM3uFmt] = useState<'m3u_plus' | 'm3u8' | 'enigma2_api'>('m3u_plus')

  // Advanced
  const [forcedConn, setForcedConn] = useState<'disabled' | 'forced_on' | 'forced_off'>('disabled')
  const [isRestreamer, setIsRestreamer] = useState(false)
  const [accessHls, setAccessHls] = useState(true)
  const [accessMpegts, setAccessMpegts] = useState(true)
  const [accessRtmp, setAccessRtmp] = useState(true)

  // Restrictions
  const [ispLock, setIspLock] = useState('')
  const [ipInput, setIpInput] = useState('')
  const [allowedIps, setAllowedIps] = useState<string[]>([])
  const [countryInput, setCountryInput] = useState('')
  const [allowedCountries, setAllowedCountries] = useState<string[]>([])
  const [uaInput, setUaInput] = useState('')
  const [allowedUAs, setAllowedUAs] = useState<string[]>([])

  // Bouquets
  const [selectedBouquets, setSelectedBouquets] = useState<Set<number>>(new Set())

  const bouquetsQ = useQuery({ queryKey: ['bouquets'], queryFn: contentApi.listBouquets })

  const adminUsersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await api.get<{ id: number; username: string }[]>('/auth/users')
      return r.data
    },
  })

  useEffect(() => {
    if (!editUser) return
    setUsername(editUser.username)
    setPassword(editUser.password)
    setOwner(editUser.owner)
    setMaxConn(editUser.max_connections)
    setIsTrial(editUser.is_trial)
    setIsEnabled(editUser.is_enabled)
    setNeverExpires(!editUser.expiry_date)
    setExpiryDate(editUser.expiry_date ? editUser.expiry_date.slice(0, 16) : '')
    setAdminNotes(editUser.admin_notes ?? '')
    setResellerNotes(editUser.reseller_notes ?? '')
    setForcedConn(editUser.forced_connection)
    setIsRestreamer(editUser.is_restreamer)
    setAccessHls(editUser.access_hls)
    setAccessMpegts(editUser.access_mpegts)
    setAccessRtmp(editUser.access_rtmp)
    setIspLock(editUser.isp_lock_info ?? '')
    setAllowedIps(editUser.allowed_ips ?? [])
    setAllowedCountries(editUser.forced_country ? editUser.forced_country.split(',').map(s => s.trim()).filter(Boolean) : [])
    setAllowedUAs(editUser.allowed_user_agents ?? [])
    setSelectedBouquets(new Set(editUser.bouquets.map(b => b.id)))
  }, [editUser])

  const saveMut = useMutation({
    mutationFn: (payload: IptvUserCreatePayload) =>
      isEdit ? iptvUsersApi.update(editUser!.id, payload) : iptvUsersApi.create(payload),
    onSuccess: onSaved,
    onError,
  })

  function buildPayload(): IptvUserCreatePayload {
    return {
      username: username.trim() || null,
      password: password.trim() || null,
      owner,
      max_connections: maxConn,
      is_trial: isTrial,
      is_enabled: isEnabled,
      expiry_date: neverExpires ? null : (expiryDate ? new Date(expiryDate).toISOString() : null),
      admin_notes: adminNotes || null,
      reseller_notes: resellerNotes || null,
      forced_connection: forcedConn,
      is_restreamer: isRestreamer,
      forced_country: allowedCountries.length > 0 ? allowedCountries.join(',') : null,
      isp_lock_info: ispLock || null,
      access_hls: accessHls,
      access_mpegts: accessMpegts,
      access_rtmp: accessRtmp,
      allowed_ips: allowedIps,
      allowed_user_agents: allowedUAs,
      bouquet_ids: Array.from(selectedBouquets),
    }
  }

  function addIp() {
    const v = ipInput.trim()
    if (v && !allowedIps.includes(v)) { setAllowedIps(p => [...p, v]); setIpInput('') }
  }

  function addCountry(cc: string) {
    const v = cc.trim().toUpperCase()
    if (v && !allowedCountries.includes(v)) setAllowedCountries(p => [...p, v])
    setCountryInput('')
  }

  function addUA() {
    const v = uaInput.trim()
    if (v && !allowedUAs.includes(v)) { setAllowedUAs(p => [...p, v]); setUaInput('') }
  }

  const tabIdx = TAB_ORDER.indexOf(tab)
  const m3uUrl = isEdit ? iptvUsersApi.m3uUrl(editUser!, m3uFmt) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 pb-0">
          <h3 className="text-xl font-semibold text-slate-900">
            {isEdit ? `Duzenle: ${editUser!.username}` : 'Yeni Kullanici'}
          </h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 transition text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-200 px-5 mt-4 gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 -mb-px transition
                ${tab === t.key ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* TAB 1: Details */}
          {tab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label">Username</label>
                  <input className="panel-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Bos birakilirsa otomatik" />
                </div>
                <div>
                  <label className="panel-label">Password</label>
                  <input className="panel-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Bos birakilirsa otomatik" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
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
                </div>
                <div>
                  <label className="panel-label">Max Baglanti <span className="text-slate-400 font-normal">(0 = sinirsiz)</span></label>
                  <input type="number" min={0} className="panel-input" value={maxConn} onChange={e => setMaxConn(Number(e.target.value))} />
                </div>
              </div>
              {isEdit && (
                <div>
                  <label className="panel-label">Olusturma Tarihi</label>
                  <input className="panel-input bg-slate-50" value={new Date(editUser!.created_at).toLocaleString('tr-TR')} disabled />
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={neverExpires} onChange={e => setNeverExpires(e.target.checked)} />
                  <span className="text-sm text-slate-700">Suresiz (bitis tarihi yok)</span>
                </label>
                {!neverExpires && (
                  <input type="datetime-local" className="panel-input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                )}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />
                  <span className="text-sm text-slate-700">Hesap Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={isTrial} onChange={e => setIsTrial(e.target.checked)} />
                  <span className="text-sm text-slate-700">Deneme Hesabi</span>
                </label>
              </div>
              <div>
                <label className="panel-label">Admin Notlari</label>
                <textarea className="panel-textarea" rows={2} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
              </div>
              <div>
                <label className="panel-label">Reseller Notlari</label>
                <textarea className="panel-textarea" rows={2} value={resellerNotes} onChange={e => setResellerNotes(e.target.value)} />
              </div>
              {isEdit && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="panel-label">Playlist Indir</label>
                  <div className="flex gap-2 mt-1">
                    <select className="panel-select flex-1" value={m3uFmt} onChange={e => setM3uFmt(e.target.value as typeof m3uFmt)}>
                      <option value="m3u_plus">M3U Plus</option>
                      <option value="m3u8">M3U8</option>
                      <option value="enigma2_api">Enigma2 API</option>
                    </select>
                    <button type="button" onClick={() => navigator.clipboard.writeText(m3uUrl)} className="secondary-button px-3" title="URL Kopyala"><Copy size={14} /></button>
                    <a href={m3uUrl} download className="primary-button px-3" title="Indir"><Download size={14} /></a>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 break-all">{m3uUrl}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Advanced */}
          {tab === 'advanced' && (
            <div className="space-y-4">
              <div>
                <label className="panel-label">Zorla Baglanti (Forced Connection)</label>
                <select className="panel-select" value={forcedConn} onChange={e => setForcedConn(e.target.value as typeof forcedConn)}>
                  <option value="disabled">Disabled</option>
                  <option value="forced_on">Forced On</option>
                  <option value="forced_off">Forced Off</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={isRestreamer} onChange={e => setIsRestreamer(e.target.checked)} />
                  <span className="text-sm text-slate-700">Restreamer Hesabi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={isTrial} onChange={e => setIsTrial(e.target.checked)} />
                  <span className="text-sm text-slate-700">Deneme Hesabi</span>
                </label>
              </div>
              <div>
                <label className="panel-label">Erisim Cikti Formatlari</label>
                <div className="flex gap-4 mt-2">
                  {[
                    { label: 'HLS', value: accessHls, set: setAccessHls },
                    { label: 'MPEG-TS', value: accessMpegts, set: setAccessMpegts },
                    { label: 'RTMP', value: accessRtmp, set: setAccessRtmp },
                  ].map(({ label, value, set }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={value} onChange={e => set(e.target.checked)} />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Restrictions */}
          {tab === 'restrictions' && (
            <div className="space-y-5">

              {/* ISP Lock */}
              <div>
                <label className="panel-label">ISP Kilidi</label>
                <div className="flex gap-2 mt-1">
                  <input className="panel-input flex-1" value={ispLock} onChange={e => setIspLock(e.target.value)}
                    placeholder="Orn: Turkcell (bos = herhangi ISP)" />
                  <button type="button" className="secondary-button px-3 flex items-center gap-1" title="Sifirla"
                    onClick={() => setIspLock('')}>
                    <RefreshCw size={13} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Bos = herhangi ISP. Dolu = sadece o ISP (case-insensitive)</p>
              </div>

              {/* Allowed IPs */}
              <div>
                <label className="panel-label">Izin Verilen IP Adresleri</label>
                <div className="flex gap-2 mt-1">
                  <input className="panel-input flex-1" value={ipInput} onChange={e => setIpInput(e.target.value)}
                    placeholder="192.168.1.1"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIp() } }}
                  />
                  <button type="button" className="secondary-button px-3" onClick={addIp}><Plus size={14} /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allowedIps.map((ip, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 text-xs font-mono text-blue-700">
                      {ip}
                      <button type="button" onClick={() => setAllowedIps(p => p.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500 ml-0.5"><X size={11} /></button>
                    </span>
                  ))}
                  {allowedIps.length === 0 && <p className="text-xs text-slate-400">Kisitlama yok (tum IP'ler)</p>}
                </div>
              </div>

              {/* Allowed Countries */}
              <div>
                <label className="panel-label">Izin Verilen Ulkeler</label>
                <div className="flex gap-2 mt-1">
                  <select className="panel-select flex-1" value={countryInput} onChange={e => setCountryInput(e.target.value)}>
                    <option value="">Ulke sec...</option>
                    {COUNTRIES.filter(c => !allowedCountries.includes(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" className="secondary-button px-3" onClick={() => { if (countryInput) addCountry(countryInput) }}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allowedCountries.map((cc, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 text-xs text-green-700">
                      <img src={`https://flagcdn.com/16x12/${cc.toLowerCase()}.png`} alt={cc} style={{ width: 16, height: 12 }} />
                      {cc}
                      <button type="button" onClick={() => setAllowedCountries(p => p.filter((_, j) => j !== i))} className="text-green-400 hover:text-red-500"><X size={11} /></button>
                    </span>
                  ))}
                  {allowedCountries.length === 0 && <p className="text-xs text-slate-400">Kisitlama yok (tum ulkeler)</p>}
                </div>
              </div>

              {/* Allowed User-Agents */}
              <div>
                <label className="panel-label">Izin Verilen User-Agent'lar</label>
                <div className="flex gap-2 mt-1">
                  <input className="panel-input flex-1" value={uaInput} onChange={e => setUaInput(e.target.value)}
                    placeholder="Mozilla/5.0..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUA() } }}
                  />
                  <button type="button" className="secondary-button px-3" onClick={addUA}><Plus size={14} /></button>
                </div>
                <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {allowedUAs.map((ua, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5">
                      <span className="text-xs text-slate-700 truncate flex-1">{ua}</span>
                      <button type="button" onClick={() => setAllowedUAs(p => p.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-600 ml-2 shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                  {allowedUAs.length === 0 && <p className="text-xs text-slate-400">Kisitlama yok (tum user-agent'lar)</p>}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Bouquets */}
          {tab === 'bouquets' && (
            <div>
              <p className="text-xs text-slate-500 mb-3">Kullaniciya atanacak bouquet'leri secin.</p>
              {bouquetsQ.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
              ) : (
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                  {(bouquetsQ.data ?? []).map(b => (
                    <label key={b.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition
                      ${selectedBouquets.has(b.id) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="h-4 w-4 accent-blue-500"
                        checked={selectedBouquets.has(b.id)}
                        onChange={e => {
                          setSelectedBouquets(prev => {
                            const n = new Set(prev)
                            e.target.checked ? n.add(b.id) : n.delete(b.id)
                            return n
                          })
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800">{b.name}</div>
                        <div className="text-xs text-slate-400">{b.item_count} medya</div>
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </label>
                  ))}
                  {(bouquetsQ.data ?? []).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">Henuz bouquet olusturulmadi.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-4">
          <button type="button" disabled={tabIdx === 0} onClick={() => setTab(TAB_ORDER[tabIdx - 1])} className="secondary-button disabled:opacity-40">
            <ChevronLeft size={16} /> Onceki
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="secondary-button">Iptal</button>
            {tabIdx < TAB_ORDER.length - 1 ? (
              <button type="button" onClick={() => setTab(TAB_ORDER[tabIdx + 1])} className="primary-button">
                Sonraki <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={() => saveMut.mutate(buildPayload())} disabled={saveMut.isPending} className="primary-button">
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {isEdit ? 'Guncelle' : 'Olustur'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}