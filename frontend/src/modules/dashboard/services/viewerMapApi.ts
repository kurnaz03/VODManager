import api from '../../../utils/api'

export type TimeRange = 'now' | '24h' | '7d'

export interface CountryStat {
  country_code: string
  country_name: string
  viewer_count: number
}

export interface ViewerMapSummary {
  countries: CountryStat[]
  total_viewers: number
  total_countries: number
}

export interface ConnectionDetail {
  ip_address: string
  username: string
  stream_name: string | null
  stream_type: string | null
  started_at: string | null
  duration_seconds: number | null
}

export interface CountryDetail {
  country_code: string
  country_name: string
  connections: ConnectionDetail[]
  total: number
}

export const viewerMapApi = {
  getSummary: (range: TimeRange): Promise<ViewerMapSummary> =>
    api.get(`/dashboard/viewer-map?range=${range}`).then((r) => r.data),

  getCountryDetail: (countryCode: string, range: TimeRange): Promise<CountryDetail> =>
    api.get(`/dashboard/viewer-map/${countryCode}?range=${range}`).then((r) => r.data),
}
