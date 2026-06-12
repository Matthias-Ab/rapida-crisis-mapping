import React, { useState, useEffect, useRef, useCallback } from 'react'
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

const POLL_INTERVAL = 60000 // 60 seconds

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const pollRef = useRef(null)
  const lastFetchRef = useRef(null)

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

  // Polling for new data
  useEffect(() => {
    pollRef.current = setInterval(async () => {
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
            const existingIds = new Set(prev.map((r) => r.properties?.id))
            const toAdd = newFeatures.filter((r) => !existingIds.has(r.properties?.id))
            if (toAdd.length === 0) return prev
            return [...prev, ...toAdd]
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
    }, POLL_INTERVAL)

    return () => clearInterval(pollRef.current)
  }, [filters])

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
          />
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

          <div className="rounded-2xl overflow-hidden flex-1 shadow-sm border border-gray-200 relative">
            <MapView
              reports={reports}
              loading={loading}
              refreshing={refreshing}
              lastRefresh={lastRefresh}
              showHeatmap={showHeatmap}
              showBuildings={showBuildings}
            />
            {showEmpty && <EmptyState onRefresh={handleManualRefresh} />}
          </div>
        </main>
      </div>
    </div>
  )
}
