import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getReports, exportCSV, exportGeoJSON } from '../../services/api'
import FilterSidebar from './FilterSidebar'
import StatsBar from './StatsBar'
import MapView from './MapView'
import LoadingSpinner from '../shared/LoadingSpinner'

const DEFAULT_FILTERS = {
  damageLevels: [],
  infraTypes: [],
  crisisTypes: [],
  dateFrom: '',
  dateTo: '',
  unverifiedOnly: false,
  flaggedOnly: false
}

function buildQueryParams(filters) {
  const params = {}
  if (filters.damageLevels?.length) params.damage_level = filters.damageLevels.join(',')
  if (filters.infraTypes?.length) params.infrastructure_type = filters.infraTypes.join(',')
  if (filters.crisisTypes?.length) params.crisis_type = filters.crisisTypes.join(',')
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo
  if (filters.unverifiedOnly) params.unverified_only = 'true'
  if (filters.flaggedOnly) params.flagged_only = 'true'
  return params
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge() {
  const [trend, setTrend] = useState(null)
  useEffect(() => {
    fetch('/api/v1/analytics/trends?hours=3')
      .then(r => r.json()).then(setTrend).catch(() => {})
  }, [])
  if (!trend) return null
  const up = trend.change_pct > 0
  const stable = trend.change_pct === 0
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-red-100 text-red-700' : stable ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
    }`}>
      {up ? '↑' : stable ? '→' : '↓'} {Math.abs(trend.change_pct)}% (3h)
    </span>
  )
}

// ── Top areas sidebar widget ──────────────────────────────────────────────────
function TopAreas({ onAreaClick }) {
  const [areas, setAreas] = useState([])

  useEffect(() => {
    fetch('/api/v1/analytics/top-areas?limit=5')
      .then(r => r.json())
      .then(setAreas)
      .catch(() => {})
  }, [])

  if (!areas.length) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mt-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Top Affected Areas</p>
      <div className="space-y-1">
        {areas.map((area, i) => {
          const sevPct = area.report_count > 0
            ? Math.round((area.complete_count / area.report_count) * 100)
            : 0
          return (
            <button
              key={i}
              onClick={() => onAreaClick({ lat: parseFloat(area.lat), lng: parseFloat(area.lng), zoom: 13 })}
              className="w-full flex items-center gap-2 text-left hover:bg-blue-50 rounded-lg p-1.5 transition-colors group"
            >
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 group-hover:text-undp-blue truncate transition-colors">{area.location_text}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-undp-red rounded-full" style={{ width: `${sevPct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{area.report_count} reports</span>
                </div>
              </div>
              <svg className="w-3 h-3 text-gray-300 group-hover:text-undp-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Priority Response Queue ───────────────────────────────────────────────────
function PriorityQueue({ apiKey, onReportClick }) {
  const [reports, setReports] = useState([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!apiKey) return
    fetch('/api/v1/analytics/priority?limit=10', {
      headers: { 'X-API-Key': apiKey }
    })
      .then(r => r.json())
      .then(setReports)
      .catch(() => {})
  }, [apiKey])

  if (!reports.length) return null

  const DAMAGE_COLORS = { complete: 'text-undp-red', partial: 'text-undp-amber', none: 'text-undp-green' }
  const DAMAGE_ICONS  = { complete: '🔴', partial: '⚠️', none: '✅' }

  return (
    <div className="bg-white rounded-xl border border-gray-200 mt-3 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🚨</span>
          <p className="text-xs font-bold text-gray-700">Priority Response Queue</p>
          <span className="bg-undp-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{reports.length}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {reports.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onReportClick(r)}
              className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
            >
              <span className="text-xs font-black text-gray-300 w-4 pt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs">{DAMAGE_ICONS[r.damage_level]}</span>
                  <span className={`text-xs font-bold capitalize ${DAMAGE_COLORS[r.damage_level]}`}>
                    {r.damage_level}
                  </span>
                  <span className="text-[10px] text-gray-400">·</span>
                  <span className="text-[10px] text-gray-500 capitalize truncate">
                    {(r.infra_type || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{r.location_text || r.crisis_type}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-[10px] font-bold text-undp-blue">{r.priority_score}</span>
                <p className="text-[9px] text-gray-400">score</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AI Insights panel ────────────────────────────────────────────────────────
function AiInsights({ apiKey }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/analytics/ai-insights', {
        headers: { 'X-API-Key': apiKey }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setInsights(data.insights || [])
      setLoaded(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  if (!apiKey) return null

  return (
    <div className="bg-white rounded-xl border border-undp-teal/20 mt-3 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">✨</span>
          <p className="text-xs font-bold text-gray-700">AI Insights</p>
          <span className="text-[10px] bg-undp-teal/10 text-undp-teal px-1.5 py-0.5 rounded-full font-semibold">Llama 3.3</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs text-undp-teal font-bold hover:underline disabled:opacity-50 transition-opacity"
        >
          {loading ? '⏳' : loaded ? '↻' : 'Generate →'}
        </button>
      </div>

      <div className="px-3 py-2.5">
        {loading && (
          <p className="text-xs text-gray-400 animate-pulse">Analysing live crisis data…</p>
        )}
        {error && !loading && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        {!loaded && !loading && !error && (
          <p className="text-xs text-gray-400">Click to generate AI observations from live data.</p>
        )}
        {insights.length > 0 && !loading && (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-undp-teal font-black text-[10px] flex-shrink-0 mt-0.5 w-3">{i + 1}.</span>
                <p className="text-xs text-gray-600 leading-snug">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state overlay ───────────────────────────────────────────────────────
function EmptyState({ onRefresh }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-8 py-8 flex flex-col items-center gap-3 max-w-xs text-center border border-gray-100">
        <span className="text-5xl" aria-hidden="true">🗺️</span>
        <h3 className="text-base font-bold text-gray-800">No reports yet</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Reports will appear here in real-time as they are submitted.
        </p>
        <button
          onClick={onRefresh}
          className="mt-1 px-5 py-2 rounded-xl bg-[#0468B1] text-white text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all"
        >
          Refresh Now
        </button>
      </div>
    </div>
  )
}

// ── Showing X of Y chip ───────────────────────────────────────────────────────
function ReportCountChip({ shown, total }) {
  return (
    <div className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 select-none whitespace-nowrap">
      Showing {shown.toLocaleString()} of {total.toLocaleString()}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [reports, setReports] = useState([])
  const [totalReportCount, setTotalReportCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showBuildings, setShowBuildings] = useState(false)
  const [showBuildingAggregate, setShowBuildingAggregate] = useState(false)
  const apiKey = sessionStorage.getItem('dashboard_key') || import.meta.env.VITE_DASHBOARD_KEY || ''
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [newReportCount, setNewReportCount] = useState(0)
  const [flyTarget, setFlyTarget] = useState(null)
  const [timelineHours, setTimelineHours] = useState(72)
  const [timelineActive, setTimelineActive] = useState(false)
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const pollRef = useRef(null)
  const lastFetchRef = useRef(null)
  const playRef = useRef(null)

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = buildQueryParams(filters)
      const res = await getReports(params)
      const features = res.data?.features || res.data || []
      setReports(features)
      // If the API returns a total count (e.g. in headers or a wrapper), use it;
      // otherwise fall back to the length of the unfiltered dataset (best-effort).
      const serverTotal = res.data?.total ?? res.headers?.['x-total-count']
      setTotalReportCount(serverTotal != null ? Number(serverTotal) : features.length)
      const now = new Date()
      lastFetchRef.current = now
      setLastRefresh(now)
    } catch {
      // silent — may be auth error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters])

  // Fetch on filter change
  useEffect(() => {
    fetchReports(false)
  }, [fetchReports])

  // SSE connection with exponential backoff and polling fallback
  useEffect(() => {
    let eventSource = null
    let destroyed = false
    let retryDelay = 5000
    let retryCount = 0
    const MAX_RETRIES = 8 // gives up after ~8.5 min of trying
    let retryTimer = null

    function getDashKey() {
      return sessionStorage.getItem('dashboard_key') || import.meta.env.VITE_DASHBOARD_KEY || ''
    }

    function connect() {
      if (destroyed || retryCount >= MAX_RETRIES) return
      if (!navigator.onLine) {
        // wait for reconnect event instead of hammering
        retryTimer = setTimeout(connect, retryDelay)
        return
      }
      const key = getDashKey()
      const url = key
        ? `/api/v1/reports/stream?key=${encodeURIComponent(key)}`
        : '/api/v1/reports/stream'
      eventSource = new EventSource(url)

      eventSource.addEventListener('new_report', (e) => {
        retryDelay = 5000 // reset backoff on successful message
        retryCount = 0
        try {
          const report = JSON.parse(e.data)
          setReports(prev => {
            const prevFeatures = Array.isArray(prev) ? prev : (prev?.features || [])
            const exists = prevFeatures.find(f => (f.id === report.id) || (f.properties?.id === report.id))
            if (exists) return prev
            const newFeature = {
              type: 'Feature',
              id: report.id,
              geometry: { type: 'Point', coordinates: [report.longitude, report.latitude] },
              properties: { ...report }
            }
            return Array.isArray(prev)
              ? [...prev, newFeature]
              : { ...prev, features: [...(prev?.features || []), newFeature], total: (prev?.total || 0) + 1 }
          })
          setLastRefresh(new Date())
          setNewReportCount(n => n + 1)
        } catch {
          // ignore malformed events
        }
      })

      eventSource.onerror = () => {
        if (eventSource) eventSource.close()
        retryCount++
        if (!destroyed && retryCount < MAX_RETRIES) {
          retryDelay = Math.min(retryDelay * 2, 60000) // cap at 60s
          retryTimer = setTimeout(connect, retryDelay)
        }
      }
    }

    connect()

    // Polling fallback every 60s as backup
    const poll = setInterval(async () => {
      if (!navigator.onLine) return
      setRefreshing(true)
      try {
        const params = buildQueryParams(filters)
        if (lastFetchRef.current) {
          params.created_after = lastFetchRef.current.toISOString()
        }
        const res = await getReports(params)
        const newFeatures = res.data?.features || res.data || []
        if (newFeatures.length > 0) {
          setReports((prev) => {
            const prevFeatures = Array.isArray(prev) ? prev : (prev?.features || [])
            const existingIds = new Set(prevFeatures.map((r) => r.properties?.id))
            const toAdd = newFeatures.filter((r) => !existingIds.has(r.properties?.id))
            if (toAdd.length === 0) return prev
            return Array.isArray(prev)
              ? [...prev, ...toAdd]
              : { ...prev, features: [...prevFeatures, ...toAdd] }
          })
          const now = new Date()
          lastFetchRef.current = now
          setLastRefresh(now)
        }
      } catch {
        // silent
      } finally {
        setRefreshing(false)
      }
    }, 60000)

    return () => {
      destroyed = true
      if (eventSource) eventSource.close()
      if (retryTimer) clearTimeout(retryTimer)
      clearInterval(poll)
    }
  }, [filters])

  // Timeline play logic
  useEffect(() => {
    if (timelinePlaying) {
      playRef.current = setInterval(() => {
        setTimelineHours(h => {
          if (h <= 1) { setTimelinePlaying(false); return 72 }
          return Math.max(1, h - 2)
        })
      }, 200)
    } else {
      clearInterval(playRef.current)
    }
    return () => clearInterval(playRef.current)
  }, [timelinePlaying])

  // Derived: filter reports by timeline
  const allFeatures = Array.isArray(reports) ? reports : (reports?.features || [])
  const visibleReports = timelineActive
    ? { type: 'FeatureCollection', features: allFeatures.filter(f => {
        const age = (Date.now() - new Date(f.properties?.created_at || f.properties?.createdAt || 0).getTime()) / 3600000
        return age <= timelineHours
      })}
    : reports

  const handleExportCSV = async () => {
    setExporting('csv')
    try {
      const res = await exportCSV(buildQueryParams(filters))
      downloadBlob(res.data, `rapida-export-${Date.now()}.csv`)
    } catch {
      // silent
    } finally {
      setExporting(null)
    }
  }

  const handleExportGeoJSON = async () => {
    setExporting('geojson')
    try {
      const res = await exportGeoJSON(buildQueryParams(filters))
      downloadBlob(res.data, `rapida-export-${Date.now()}.geojson`)
    } catch {
      // silent
    } finally {
      setExporting(null)
    }
  }

  const handleManualRefresh = useCallback(() => {
    fetchReports(true)
  }, [fetchReports])

  const showEmpty = !loading && reports.length === 0

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-undp-blue text-white px-4 py-3 flex items-center gap-3 shadow-md z-10 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Toggle filters"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="font-bold text-lg flex-1">{t('dashboard_title')}</h1>

        {/* Map controls */}
        <button
          onClick={() => setShowHeatmap((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showHeatmap ? 'bg-white text-undp-blue' : 'bg-white/20 hover:bg-white/30'}`}
        >
          {t('map_heatmap')}
        </button>
        <button
          onClick={() => setShowBuildings((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hidden sm:inline-flex ${showBuildings ? 'bg-white text-undp-blue' : 'bg-white/20 hover:bg-white/30'}`}
        >
          {t('map_buildings')}
        </button>
        <button
          onClick={() => setShowBuildingAggregate((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hidden sm:inline-flex ${showBuildingAggregate ? 'bg-white text-undp-blue' : 'bg-white/20 hover:bg-white/30'}`}
        >
          Building Summary
        </button>
        <button
          onClick={() => setTimelineActive(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hidden sm:inline-flex ${timelineActive ? 'bg-white text-undp-blue' : 'bg-white/20 hover:bg-white/30'}`}
        >
          ⏱ Timeline
        </button>

        {/* Export */}
        <button
          onClick={handleExportCSV}
          disabled={!!exporting}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors hidden sm:inline-flex items-center gap-1"
        >
          {exporting === 'csv' ? <LoadingSpinner size="sm" color="white" /> : '📥'}
          {t('export_csv')}
        </button>
        <button
          onClick={handleExportGeoJSON}
          disabled={!!exporting}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors hidden sm:inline-flex items-center gap-1"
        >
          {exporting === 'geojson' ? <LoadingSpinner size="sm" color="white" /> : '🗺️'}
          {t('export_geojson')}
        </button>

        <Link
          to="/situation-report"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors hidden sm:inline-flex items-center gap-1"
        >
          📋 Situation Report
        </Link>

        {refreshing && (
          <span className="text-xs opacity-70 animate-pulse">{t('map_refresh')}</span>
        )}
      </header>

      {/* Stats bar */}
      <StatsBar />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-20 md:relative md:flex md:flex-shrink-0 transition-transform
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={reports.length}
            totalCount={totalReportCount}
            trendBadge={<TrendBadge />}
          />
          <div className="px-3">
            <TopAreas onAreaClick={({ lat, lng, zoom }) => setFlyTarget({ lat, lng, zoom })} />
            <AiInsights apiKey={apiKey} />
            <PriorityQueue
              apiKey={apiKey}
              onReportClick={(r) => setFlyTarget({ lat: r.latitude, lng: r.longitude, zoom: 17 })}
            />
          </div>
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-[-1] md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>

        {/* Map area */}
        <main className="flex-1 overflow-hidden p-2 md:p-3 flex flex-col gap-2">
          {/* Showing X of Y chip */}
          <div className="flex items-center justify-end px-1">
            <ReportCountChip shown={reports.length} total={totalReportCount} />
          </div>

          <div className="rounded-2xl overflow-hidden flex-1 shadow-sm border border-gray-200 relative flex flex-col">
            <div className="flex-1 relative">
              <MapView
                reports={Array.isArray(visibleReports) ? visibleReports : (visibleReports?.features || [])}
                loading={loading}
                refreshing={refreshing}
                lastRefresh={lastRefresh}
                showHeatmap={showHeatmap}
                showBuildings={showBuildings}
                showBuildingAggregate={showBuildingAggregate}
                apiKey={apiKey}
                flyTarget={flyTarget}
              />
              {showEmpty && <EmptyState onRefresh={handleManualRefresh} />}
              {newReportCount > 0 && (
                <button
                  onClick={() => setNewReportCount(0)}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-undp-blue text-white text-xs font-bold rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <span>New {newReportCount} report{newReportCount !== 1 ? 's' : ''}</span>
                  <span className="text-white/70 text-[10px]">click to dismiss</span>
                </button>
              )}
            </div>
            {timelineActive && (
              <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setTimelinePlaying(v => !v)}
                  className="text-undp-blue font-bold text-sm w-6"
                >
                  {timelinePlaying ? '⏸' : '▶'}
                </button>
                <div className="flex-1">
                  <input
                    type="range" min="1" max="72" step="1"
                    value={timelineHours}
                    onChange={e => { setTimelineHours(Number(e.target.value)); setTimelinePlaying(false) }}
                    className="w-full accent-undp-blue"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 -mt-0.5">
                    <span>72h ago</span><span>36h ago</span><span>now</span>
                  </div>
                </div>
                <div className="text-xs text-right text-gray-600 min-w-fit">
                  <p className="font-bold">
                    {(Array.isArray(visibleReports) ? visibleReports : (visibleReports?.features || [])).length} reports
                  </p>
                  <p className="text-[10px] text-gray-400">≤ {timelineHours}h ago</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
