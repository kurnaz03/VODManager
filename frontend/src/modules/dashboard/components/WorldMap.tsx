import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import type { CountryStat } from '../services/viewerMapApi'

const GEO_URL = '/assets/world-110m.json'

// ISO 3166-1 numeric -> alpha-2 mapping
// world-atlas countries-110m.json uses geo.id = numeric string (e.g. "792" for TR)
// Backend returns alpha-2 codes, so we need this mapping to match them
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "4":"AF","8":"AL","12":"DZ","24":"AO","32":"AR","36":"AU","40":"AT",
  "44":"BS","48":"BH","50":"BD","52":"BB","56":"BE","64":"BT","68":"BO",
  "76":"BR","84":"BZ","90":"SB","96":"BN","100":"BG","104":"MM","116":"KH",
  "120":"CM","124":"CA","132":"CV","140":"CF","144":"LK","148":"TD",
  "152":"CL","156":"CN","170":"CO","174":"KM","175":"YT","180":"CD",
  "184":"CK","188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ",
  "204":"BJ","208":"DK","212":"DM","214":"DO","218":"EC","222":"SV",
  "226":"GQ","231":"ET","232":"ER","238":"FK","242":"FJ","246":"FI",
  "250":"FR","266":"GA","270":"GM","276":"DE","288":"GH","292":"GI",
  "296":"KI","300":"GR","308":"GD","320":"GT","324":"GN","328":"GY",
  "332":"HT","334":"HM","336":"VA","340":"HN","348":"HU","352":"IS",
  "356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE","376":"IL",
  "380":"IT","384":"CI","388":"JM","392":"JP","396":"MH","398":"KZ",
  "400":"JO","404":"KE","408":"KP","410":"KR","414":"KW","418":"LA",
  "422":"LB","426":"LS","428":"LV","430":"LR","434":"LY","440":"LT",
  "442":"LU","450":"MG","454":"MW","458":"MY","462":"MV","466":"ML",
  "470":"MT","480":"MU","484":"MX","492":"MC","496":"MN","498":"MD",
  "499":"ME","504":"MA","508":"MZ","516":"NA","520":"NR","524":"NP",
  "528":"NL","540":"NC","548":"VU","554":"NZ","558":"NI","562":"NE",
  "566":"NG","570":"NU","574":"NF","578":"NO","583":"FM","585":"PW",
  "586":"PK","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH",
  "616":"PL","620":"PT","624":"GW","626":"TL","630":"PR","634":"QA",
  "642":"RO","643":"RU","646":"RW","659":"KN","662":"LC","670":"VC",
  "674":"SM","678":"ST","682":"SA","686":"SN","690":"SC","694":"SL",
  "702":"SG","703":"SK","704":"VN","705":"SI","706":"SO","710":"ZA",
  "716":"ZW","724":"ES","729":"SD","740":"SR","748":"SZ","752":"SE",
  "756":"CH","760":"SY","762":"TJ","764":"TH","768":"TG","772":"TK",
  "776":"TO","780":"TT","784":"AE","788":"TN","792":"TR","798":"TV",
  "800":"UG","804":"UA","818":"EG","826":"GB","834":"TZ","840":"US",
  "858":"UY","860":"UZ","862":"VE","882":"WS","887":"YE","894":"ZM",
}

// Alpha-2 normalization for known API quirks
const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  XK: 'XK', // Kosovo (not in ISO standard but used by some APIs)
}

function normalizeCode(code: string): string {
  const upper = code.toUpperCase()
  return CODE_ALIASES[upper] ?? upper
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
                // world-atlas countries-110m.json stores numeric ISO code in geo.id
                // e.g. geo.id = "792" for Turkey, "276" for Germany
                // geo.properties has "name" but NOT ISO_A2, so we use geo.id + NUMERIC_TO_ALPHA2
                const numericId = String(geo.id ?? '')
                const alpha2FromNumeric = NUMERIC_TO_ALPHA2[numericId] ?? ''

                // Fallback: try properties ISO_A2 in case a different TopoJSON is used
                const isoA2Prop =
                  geo.properties?.ISO_A2 ??
                  geo.properties?.iso_a2 ??
                  geo.properties?.ISO_A2_EH ??
                  ''

                const isoA2 = alpha2FromNumeric || isoA2Prop
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
