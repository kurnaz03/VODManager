import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import type { CountryStat } from '../services/viewerMapApi'

const GEO_URL = '/assets/world-110m.json'

// ISO 3166-1 alpha-2 normalization (TopoJSON uses ISO_A2 which can differ)
const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  XK: 'XK', // Kosovo
}

function normalizeCode(code: string): string {
  return CODE_ALIASES[code.toUpperCase()] ?? code.toUpperCase()
}

interface TooltipState {
  x: number
  y: number
  name: string
  count: number
}

interface WorldMapProps {
  countries: CountryStat[]
  onCountryClick: (code: string) => void
}

export default function WorldMap({ countries, onCountryClick }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const countMap = new Map<string, CountryStat>()
  for (const c of countries) {
    countMap.set(normalizeCode(c.country_code), c)
  }

  const maxCount = Math.max(...countries.map((c) => c.viewer_count), 1)

  const colorScale = scaleLinear<string>()
    .domain([0, maxCount])
    .range(['#bfdbfe', '#1d4ed8']) // from light-blue to dark-blue

  return (
    <div className="relative w-full h-full select-none">
      <ComposableMap
        projectionConfig={{ scale: 140, center: [10, 10] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isoA2 =
                  geo.properties?.ISO_A2 ??
                  geo.properties?.iso_a2 ??
                  ''
                const normalized = normalizeCode(isoA2)
                const stat = countMap.get(normalized)
                const fill = stat ? colorScale(stat.viewer_count) : '#e2e8f0'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: 'none', cursor: stat ? 'pointer' : 'default' },
                      hover: {
                        outline: 'none',
                        fill: stat ? '#1e40af' : '#cbd5e1',
                        cursor: stat ? 'pointer' : 'default',
                      },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={(evt) => {
                      if (!stat) return
                      setTooltip({
                        x: evt.clientX,
                        y: evt.clientY,
                        name: stat.country_name,
                        count: stat.viewer_count,
                      })
                    }}
                    onMouseMove={(evt) => {
                      if (!stat) return
                      setTooltip((prev) =>
                        prev ? { ...prev, x: evt.clientX, y: evt.clientY } : null,
                      )
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      if (stat) onCountryClick(stat.country_code)
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          <span className="font-semibold">{tooltip.name}</span>
          <span className="ml-2 text-slate-300">{tooltip.count} izleyici</span>
        </div>
      )}

      {/* Color legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-1 text-[10px] text-slate-600 shadow">
        <div className="h-2 w-16 rounded-sm bg-gradient-to-r from-[#bfdbfe] to-[#1d4ed8]" />
        <span>Az</span>
        <span className="mx-1">→</span>
        <span>Çok</span>
      </div>
    </div>
  )
}
