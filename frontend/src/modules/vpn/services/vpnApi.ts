import api from '../../../utils/api'

export interface VpnClient {
  id: number
  name: string
  description: string | null
  user_id: number | null
  cert_path: string | null
  key_path: string | null
  ovpn_path: string | null
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface VpnClientCreate {
  name: string
  description?: string | null
}

export interface VpnServerConfig {
  id: number
  server_ip: string
  server_port: number
  protocol: 'udp' | 'tcp'
  ca_cert_path: string
  server_cert_path: string
  server_key_path: string
  dh_params_path: string
  ta_key_path: string
  easy_rsa_dir: string
  clients_dir: string
  updated_at: string
}

export const vpnApi = {
  listClients: (): Promise<VpnClient[]> =>
    api.get('/openvpn/clients').then((r) => r.data),

  createClient: (payload: VpnClientCreate): Promise<VpnClient> =>
    api.post('/openvpn/clients', payload).then((r) => r.data),

  deleteClient: (id: number): Promise<void> =>
    api.delete(`/openvpn/clients/${id}`).then(() => undefined),

  downloadOvpn: async (id: number, name: string): Promise<void> => {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`/api/v1/openvpn/clients/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Download failed')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.ovpn`
    a.click()
    window.URL.revokeObjectURL(url)
  },

  getServerConfig: (): Promise<VpnServerConfig> =>
    api.get('/openvpn/server-config').then((r) => r.data),

  updateServerConfig: (payload: Omit<VpnServerConfig, 'id' | 'updated_at'>): Promise<VpnServerConfig> =>
    api.put('/openvpn/server-config', payload).then((r) => r.data),
}
