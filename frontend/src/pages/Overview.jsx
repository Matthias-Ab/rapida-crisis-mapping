import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Public overview page — no authentication required.
// Uses only aggregate/cluster data so no individual report details are exposed.

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DAMAGE_COLOR = { none: '#00833E', partial: '#F5A623', complete: '#D12800' }
const CRISIS_EMOJI = {
  earthquake: '🌍', flood: '🌊', tsunami: '🌊', hurricane_cyclone: '🌀',
  wildfire: '🔥', explosion: '💥', chemical_incident: '☣️', conflict: '⚔️', civil_unrest: '🚧',
}

function ClusterLayer() {
  const map = useMap()
  const groupRef = useRef(null)

  useEffect(() => {
    fetch('/api/v1/analytics/consolidated')
      .then(r => r.json())
      .then(({ clusters = [] }) => {
        if (groupRef.current) map.removeLayer(groupRef.current)
        const group = L.layerGroup()

        clusters.forEach(c => {
          const color = DAMAGE_COLOR[c.dominant_damage] || DAMAGE_COLOR.partial
          const r = Math.max(14, Math.min(38, 10 + c.report_count * 3))

          const icon = L.divIcon({
            html: `<div style="
              width:${r * 2}px;height:${r * 2}px;
              background:${color};border:3px solid white;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 10px rgba(0,0,0,.3);
              font-weight:900;font-size:${r < 18 ? 10 : 13}px;color:white;
            ">${c.report_count}</div>`,
            iconSize: [r * 2, r * 2], iconAnchor: [r, r], className: '',
          })

          const marker = L.marker([c.lat, c.lng], { icon })
          marker.bindPopup(`
            <div style="min-width:170px;font-family:sans-serif;padding:4px 0">
              <p style="font-weight:700;margin:0 0 3px;font-size:13px">
                ${c.location_text || 'Incident cluster'}
              </p>
              <p style="font-size:11px;color:#666;margin:0 0 6px">
                ${c.report_count} reports
              </p>
              <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:10px">
                ${c.complete_count > 0 ? `<span style="background:#D12800;color:#fff;padding:2px 7px;border-radius:10px">🔴 ${c.complete_count} critical</span>` : ''}
                ${c.partial_count > 0  ? `<span style="background:#F5A623;color:#fff;padding:2px 7px;border-radius:10px">⚠️ ${c.partial_count} partial</span>`   : ''}
              </div>
              ${c.crisis_types?.length ? `<p style="font-size:10px;color:#888;margin:5px 0 0">${c.crisis_types.join(' · ')}</p>` : ''}
            </div>
          `)
          group.addLayer(marker)
        })

        group.addTo(map)
        groupRef.current = group
      })
      .catch(() => {})

    return () => { if (groupRef.current) map.removeLayer(groupRef.current) }
  }, [map])

  return null
}

function ActivityChart({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-px h-12 w-full">
      {data.map((d, i) => {
        const h = Math.max(2, (d.total / max) * 48)
        return (
          <div key={i} className="flex-1 flex flex-col justify-end" title={`${d.total} reports`}>
            <div className="w-full rounded-sm bg-undp-red/70" style={{ height: h }} />
          </div>
        )
      })}
    </div>
  )
}

export default function Overview() {
  const { t } = useTranslation()
  const [analytics, setAnalytics] = useState(null)
  const [topAreas, setTopAreas]   = useState([])
  const [timeseries, setTimeseries] = useState([])
  const [trends, setTrends]       = useState(null)
  const [alerts, setAlerts]       = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/analytics').then(r => r.json()),
      fetch('/api/v1/analytics/top-areas?limit=6').then(r => r.json()),
      fetch('/api/v1/analytics/timeseries').then(r => r.json()),
      fetch('/api/v1/analytics/trends?hours=3').then(r => r.json()),
      fetch('/api/v1/analytics/alerts').then(r => r.json()),
    ]).then(([a, areas, ts, tr, al]) => {
      setAnalytics(a)
      setTopAreas(areas || [])
      setTimeseries(ts || [])
      setTrends(tr)
      setAlerts(al.alerts || [])
    }).catch(() => {})

    // Refresh every 60s
    const id = setInterval(() => {
      fetch('/api/v1/analytics').then(r => r.json()).then(setAnalytics).catch(() => {})
      fetch('/api/v1/analytics/alerts').then(r => r.json()).then(d => setAlerts(d.alerts || [])).catch(() => {})
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const byDamage = analytics?.by_damage_level || {}
  const total    = analytics?.total_reports || 0
  const topCrisis = Object.entries(analytics?.by_crisis_type || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4)

  const trendDir  = trends?.change_pct > 5 ? '↑' : trends?.change_pct < -5 ? '↓' : '→'
  const trendColor = trends?.change_pct > 5 ? 'text-undp-red' : trends?.change_pct < -5 ? 'text-undp-green' : 'text-gray-500'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-undp-blue text-white shadow-md flex-shrink-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-undp-blue font-black text-xs">UN</span>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">RAPIDA Crisis Map</h1>
              <p className="text-blue-200 text-[10px]">Public Situation Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/submit"
              className="bg-white text-undp-blue px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              + Report Damage
            </Link>
          </div>
        </div>
      </header>

      {/* Mass incident alert banner */}
      {alerts.length > 0 && (
        <div className="bg-undp-red/10 border-b-2 border-undp-red px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-undp-red opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-undp-red" />
            </span>
            <p className="text-xs font-bold text-undp-red">
              ⚠️ Mass Incident Alert — {alerts[0].count} critical reports near {alerts[0].location || 'unknown area'}
              {alerts.length > 1 && ` (+${alerts.length - 1} more)`}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full px-4 py-5 flex-1 flex flex-col gap-5">

        {/* Key stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Reports',       value: total.toLocaleString(),                                       icon: '📋', color: 'text-undp-blue' },
            { label: 'Est. People Affected', value: analytics?.estimated_affected ? `~${analytics.estimated_affected.toLocaleString()}` : '—', icon: '👥', color: 'text-undp-red' },
            { label: 'Buildings Affected',  value: (analytics?.unique_buildings_affected || 0).toLocaleString(), icon: '🏢', color: 'text-undp-amber' },
            { label: 'Trend (3h)',           value: trends ? `${trendDir} ${Math.abs(trends.change_pct)}%` : '—', icon: '📈', color: trendColor },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl mb-1" aria-hidden="true">{s.icon}</p>
              <p className={`text-2xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 420 }}>
          <MapContainer
            center={[20, 15]} zoom={2}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <ClusterLayer />
          </MapContainer>
        </div>

        {/* Bottom grid: damage + crisis + areas + chart */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Damage distribution */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Damage Breakdown</h2>
            {total > 0 ? (
              <>
                <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
                  {['none','partial','complete'].map(lvl => {
                    const cnt = byDamage[lvl] || 0
                    const pct = Math.round((cnt / total) * 100)
                    return pct > 0 ? (
                      <div key={lvl} className="transition-all" style={{ width:`${pct}%`, background: DAMAGE_COLOR[lvl] }} title={`${lvl}: ${pct}%`} />
                    ) : null
                  })}
                </div>
                <div className="flex gap-4 text-xs text-gray-600">
                  {[['none','✅','No damage'],['partial','⚠️','Partial'],['complete','🔴','Complete']].map(([lvl, em, lbl]) => (
                    <span key={lvl} className="flex items-center gap-1">
                      {em} <strong>{byDamage[lvl] || 0}</strong> {lbl}
                    </span>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-gray-400">No data yet</p>}
          </div>

          {/* Top crisis types */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Crisis Types</h2>
            <div className="space-y-1.5">
              {topCrisis.length > 0 ? topCrisis.map(([type, count]) => {
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-base w-5 flex-shrink-0">{CRISIS_EMOJI[type] || '⚠️'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="capitalize text-gray-700">{type.replace(/_/g,' ')}</span>
                        <span className="text-gray-400">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-undp-blue rounded-full" style={{ width:`${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              }) : <p className="text-sm text-gray-400">No data yet</p>}
            </div>
          </div>

          {/* Top affected areas */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Most Affected Areas</h2>
            <div className="space-y-2">
              {topAreas.length > 0 ? topAreas.map((area, i) => {
                const sevPct = area.report_count > 0 ? Math.round((area.complete_count / area.report_count) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{area.location_text}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-undp-red rounded-full" style={{ width:`${sevPct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{area.report_count} reports</span>
                      </div>
                    </div>
                  </div>
                )
              }) : <p className="text-sm text-gray-400">No location data yet</p>}
            </div>
          </div>

          {/* Activity chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Report Activity — Last 48h</h2>
              <span className="text-xs text-gray-400">{timeseries.reduce((s, d) => s + d.total, 0)} total</span>
            </div>
            <ActivityChart data={timeseries} />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>48h ago</span><span>24h ago</span><span>now</span>
            </div>
          </div>
        </div>

        {/* CTA footer */}
        <div className="bg-undp-blue rounded-2xl p-6 text-center text-white">
          <p className="text-lg font-bold mb-1">See damage in your area?</p>
          <p className="text-blue-200 text-sm mb-4">Your report takes 60 seconds and helps coordinate crisis response.</p>
          <Link
            to="/submit"
            className="inline-flex items-center gap-2 bg-white text-undp-blue px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
          >
            📷 Submit a Report
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 pb-2">
          Data updates every 60 seconds · Reports are anonymised · No personal data collected ·{' '}
          <Link to="/privacy" className="underline hover:text-undp-blue">Privacy Policy</Link>
          {' · '}
          <Link to="/dashboard" className="underline hover:text-undp-blue">Analyst Dashboard</Link>
        </p>
      </div>
    </div>
  )
}
