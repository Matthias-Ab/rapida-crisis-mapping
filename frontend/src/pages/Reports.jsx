import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getReports } from '../services/api'

const DAMAGE_CONFIG = {
  none:     { label: 'No Damage',    color: 'bg-green-100 text-green-800',  dot: 'bg-undp-green',  icon: '✅' },
  partial:  { label: 'Partial',      color: 'bg-amber-100 text-amber-800',  dot: 'bg-undp-amber',  icon: '⚠️' },
  complete: { label: 'Complete',     color: 'bg-red-100 text-red-800',      dot: 'bg-undp-red',    icon: '🔴' },
}

const INFRA_ICONS = {
  residential: '🏠', commercial: '🏪', government: '🏛️', utility: '⚡',
  transport_communication: '🛣️', community: '🏫', public_recreation: '🏟️', other: '❓',
}

const CRISIS_ICONS = {
  earthquake: '🌍', flood: '🌊', tsunami: '🌊', hurricane_cyclone: '🌀',
  wildfire: '🔥', explosion: '💥', chemical_incident: '☣️', conflict: '⚔️', civil_unrest: '🚧',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function publicMediaUrl(url) {
  if (!url) return null
  return url.replace(/https?:\/\/minio:\d+/, import.meta.env.VITE_MINIO_PUBLIC_URL || 'http://localhost:9000')
}

function ReportCard({ report }) {
  const p = report.properties || {}
  const dmg = DAMAGE_CONFIG[p.damage_level] || DAMAGE_CONFIG.partial
  const [imgErr, setImgErr] = useState(false)
  const thumbUrl = publicMediaUrl(p.thumbnail_url)

  return (
    <Link
      to={`/reports/${report.id || p.id}`}
      className="flex gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-undp-blue/40 hover:shadow-md transition-all group"
    >
      {/* Thumbnail */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {thumbUrl && !imgErr ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {dmg.icon}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dmg.color}`}>
            {dmg.icon} {dmg.label}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(p.created_at)}</span>
        </div>

        <p className="text-sm font-medium text-gray-800 flex items-center gap-1 truncate">
          <span>{INFRA_ICONS[p.infra_type] || '🏗️'}</span>
          <span className="truncate capitalize">{(p.infra_type || '').replace(/_/g, ' ')}</span>
          <span className="text-gray-400">·</span>
          <span>{CRISIS_ICONS[p.crisis_type] || '⚠️'}</span>
          <span className="truncate capitalize">{(p.crisis_type || '').replace(/_/g, ' ')}</span>
        </p>

        {p.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
        )}

        <p className="text-xs text-gray-400 mt-1 truncate">
          📍 {p.location_text || `${report.geometry?.coordinates?.[1]?.toFixed(4)}, ${report.geometry?.coordinates?.[0]?.toFixed(4)}`}
        </p>
      </div>

      <svg className="w-4 h-4 text-gray-300 group-hover:text-undp-blue self-center flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export default function Reports() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState({ damage_level: '', crisis_type: '' })
  const LIMIT = 20

  const load = useCallback(async (off = 0, filters = filter) => {
    setLoading(true)
    try {
      const params = { limit: LIMIT, offset: off }
      if (filters.damage_level) params.damage_level = filters.damage_level
      if (filters.crisis_type) params.crisis_type = filters.crisis_type

      // Use public analytics key — getReports requires X-API-Key
      // Store key in sessionStorage if evaluator has it, or show a note
      const res = await getReports(params)
      const features = res.data.features || []
      setReports(off === 0 ? features : prev => [...prev, ...features])
      setTotal(res.data.total || 0)
      setOffset(off + features.length)
    } catch {
      // API key not set — show helpful message
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load(0) }, []) // eslint-disable-line

  function applyFilter(key, val) {
    const f = { ...filter, [key]: val }
    setFilter(f)
    setOffset(0)
    load(0, f)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-undp-blue text-white px-4 py-3 sticky top-0 z-50 shadow flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/20 transition-colors" aria-label="Back">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-base">All Reports</h1>
          <p className="text-xs text-blue-200">{total.toLocaleString()} total</p>
        </div>
        <Link to="/submit" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium transition-colors">
          + Submit
        </Link>
      </header>

      {/* Quick filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
        <FilterChip label="All damage" value="" current={filter.damage_level} onSelect={v => applyFilter('damage_level', v)} />
        <FilterChip label="✅ None" value="none" current={filter.damage_level} onSelect={v => applyFilter('damage_level', v)} />
        <FilterChip label="⚠️ Partial" value="partial" current={filter.damage_level} onSelect={v => applyFilter('damage_level', v)} />
        <FilterChip label="🔴 Complete" value="complete" current={filter.damage_level} onSelect={v => applyFilter('damage_level', v)} />
        <span className="text-gray-200">|</span>
        <FilterChip label="🌍 Earthquake" value="earthquake" current={filter.crisis_type} onSelect={v => applyFilter('crisis_type', v)} />
        <FilterChip label="🌊 Flood" value="flood" current={filter.crisis_type} onSelect={v => applyFilter('crisis_type', v)} />
        <FilterChip label="⚔️ Conflict" value="conflict" current={filter.crisis_type} onSelect={v => applyFilter('crisis_type', v)} />
      </div>

      {/* List */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading && reports.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-undp-blue border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🗺️</div>
            <p className="font-bold text-gray-700 mb-1">No reports found</p>
            <p className="text-sm text-gray-500 mb-4">
              The dashboard API key is required to list reports.<br />
              Set it in the dashboard or enter it below.
            </p>
            <ApiKeyPrompt onSet={() => load(0)} />
          </div>
        )}

        {reports.map((r) => (
          <ReportCard key={r.id || r.properties?.id} report={r} />
        ))}

        {reports.length > 0 && reports.length < total && (
          <button
            onClick={() => load(offset)}
            disabled={loading}
            className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:border-undp-blue hover:text-undp-blue transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : `Load more (${total - reports.length} remaining)`}
          </button>
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, value, current, onSelect }) {
  const active = current === value
  return (
    <button
      onClick={() => onSelect(active ? '' : value)}
      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
        active ? 'bg-undp-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

function ApiKeyPrompt({ onSet }) {
  const [key, setKey] = useState('')
  return (
    <div className="flex gap-2 max-w-sm mx-auto">
      <input
        type="password"
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="Enter dashboard API key"
        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-undp-blue"
      />
      <button
        onClick={() => { if (key) { sessionStorage.setItem('dashboard_key', key); onSet() } }}
        className="px-4 py-2 bg-undp-blue text-white rounded-xl text-sm font-medium"
      >
        Go
      </button>
    </div>
  )
}
