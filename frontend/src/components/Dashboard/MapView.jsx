import React, { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.heat'
import { useTranslation } from 'react-i18next'
import BuildingLayer from '../Map/BuildingLayer'
import LoadingSpinner from '../shared/LoadingSpinner'
import { flagReport } from '../../services/api'
import { useStore } from '../../store'

// ── FlyTo handler ─────────────────────────────────────────────────────────────
function FlyToHandler({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom || 14, { duration: 1.2 })
  }, [target, map])
  return null
}

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const DAMAGE_COLORS = {
  none: '#00833E',
  partial: '#F5A623',
  complete: '#D12800'
}

const DAMAGE_BG = {
  none: 'bg-emerald-600',
  partial: 'bg-amber-500',
  complete: 'bg-red-600'
}

const DAMAGE_EMOJI = {
  none: '✅',
  partial: '⚠️',
  complete: '🔴'
}

// ── Utility: humanise a date string ──────────────────────────────────────────
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Utility: humanise seconds-ago into a "LIVE" status string ────────────────
function liveStatus(lastRefreshDate, refreshing) {
  if (refreshing) return { label: 'Updating…', kind: 'updating' }
  if (!lastRefreshDate) return { label: 'LIVE', kind: 'live' }
  const ageMs = Date.now() - lastRefreshDate.getTime()
  if (ageMs < 60000) return { label: 'LIVE', kind: 'live' }
  const ageMin = Math.floor(ageMs / 60000)
  return { label: `Updated ${ageMin}m ago`, kind: 'stale' }
}

// ── Consolidated cluster layer — one marker per incident group ────────────────
function ConsolidatedLayer({ apiKey }) {
  const map = useMap()
  const groupRef = useRef(null)
  const [clusters, setClusters] = useState([])

  useEffect(() => {
    fetch('/api/v1/analytics/consolidated')
      .then(r => r.json())
      .then(d => setClusters(d.clusters || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!map || !clusters.length) return

    if (groupRef.current) map.removeLayer(groupRef.current)
    const group = L.layerGroup()

    clusters.forEach(c => {
      const color = DAMAGE_COLORS[c.dominant_damage] || DAMAGE_COLORS.partial
      const r = Math.max(16, Math.min(40, 12 + c.report_count * 3))

      const icon = L.divIcon({
        html: `
          <div style="
            width:${r * 2}px; height:${r * 2}px;
            background:${color}; border:3px solid white;
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            font-weight:900; font-size:${r < 20 ? 10 : 13}px; color:white;
          ">${c.report_count}</div>`,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
        className: ''
      })

      const marker = L.marker([c.lat, c.lng], { icon })
      marker.bindPopup(`
        <div style="min-width:180px;font-family:sans-serif">
          <p style="font-weight:700;margin:0 0 4px">${c.location_text || 'Incident cluster'}</p>
          <p style="font-size:12px;color:#555;margin:0 0 6px">
            ${c.report_count} independent reporters
          </p>
          <div style="display:flex;gap:6px;font-size:11px;margin-bottom:6px">
            ${c.complete_count > 0 ? `<span style="background:#D12800;color:white;padding:1px 6px;border-radius:8px">🔴 ${c.complete_count} complete</span>` : ''}
            ${c.partial_count  > 0 ? `<span style="background:#F5A623;color:white;padding:1px 6px;border-radius:8px">⚠️ ${c.partial_count} partial</span>` : ''}
          </div>
          ${c.crisis_types?.length ? `<p style="font-size:11px;color:#777;margin:0">${c.crisis_types.join(', ')}</p>` : ''}
        </div>
      `)
      group.addLayer(marker)
    })

    group.addTo(map)
    groupRef.current = group
    return () => { if (groupRef.current) map.removeLayer(groupRef.current) }
  }, [map, clusters])

  return null
}

function HeatmapLayer({ reports }) {
  const map = useMap()
  const heatLayerRef = useRef(null)

  useEffect(() => {
    if (!L.heatLayer) return

    const points = reports
      .filter((r) => r.geometry?.coordinates)
      .map((r) => {
        const [lng, lat] = r.geometry.coordinates
        const intensity = r.properties?.damage_level === 'complete' ? 1.0
          : r.properties?.damage_level === 'partial' ? 0.6 : 0.3
        return [lat, lng, intensity]
      })

    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current)

    if (points.length > 0) {
      heatLayerRef.current = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.3: '#00833E', 0.6: '#F5A623', 1.0: '#D12800' }
      }).addTo(map)
    }

    return () => {
      if (heatLayerRef.current) map.removeLayer(heatLayerRef.current)
    }
  }, [map, reports])

  return null
}

// Needs heatmap — shows where specific humanitarian needs are concentrated
const NEEDS_GRADIENTS = {
  rescue:        { 0.3: '#fdcb6e', 1.0: '#e17055' },
  medical:       { 0.3: '#74b9ff', 1.0: '#0984e3' },
  water:         { 0.3: '#81ecec', 1.0: '#00b894' },
  food:          { 0.3: '#a29bfe', 1.0: '#6c5ce7' },
  shelter:       { 0.3: '#fd79a8', 1.0: '#e84393' },
  electricity:   { 0.3: '#ffeaa7', 1.0: '#fdcb6e' },
  all:           { 0.3: '#fd79a8', 1.0: '#d63031' }
}

function NeedsHeatmapLayer({ reports, needType = 'all' }) {
  const map = useMap()

  useEffect(() => {
    if (!L.heatLayer || !map) return

    const points = reports
      .filter(r => {
        if (!r.geometry?.coordinates) return false
        const needs = r.properties?.pressing_needs
        const arr = Array.isArray(needs) ? needs : []
        return needType === 'all' ? arr.length > 0 : arr.includes(needType)
      })
      .map(r => {
        const [lng, lat] = r.geometry.coordinates
        return [lat, lng, 1.0]
      })

    let layer = null
    if (points.length > 0) {
      layer = L.heatLayer(points, {
        radius: 30, blur: 20, maxZoom: 17,
        gradient: NEEDS_GRADIENTS[needType] || NEEDS_GRADIENTS.all
      }).addTo(map)
    }

    return () => {
      if (layer) { try { map.removeLayer(layer) } catch {} }
    }
  }, [map, reports, needType])

  return null
}

function ClusteredMarkers({ reports, onMarkerClick }) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current)

    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      // Color cluster by worst damage level among its children
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers()
        const levels  = markers.map(m => m._rapida_damage || 'none')
        const hasComplete = levels.includes('complete')
        const hasPartial  = levels.includes('partial')
        const color = hasComplete ? '#D12800' : hasPartial ? '#F5A623' : '#00833E'

        const count = cluster.getChildCount()
        const size  = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 52 : 60
        const fs    = count < 100 ? 13 : 11

        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:3px solid white;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 10px rgba(0,0,0,.35);
            font-weight:900;font-size:${fs}px;color:white;
          ">${count}</div>`,
          iconSize:   [size, size],
          iconAnchor: [size / 2, size / 2],
          className:  ''
        })
      }
    })

    reports.forEach((report) => {
      if (!report.geometry?.coordinates) return
      const [lng, lat] = report.geometry.coordinates
      const damage = report.properties?.damage_level || 'partial'
      const color  = DAMAGE_COLORS[damage] || DAMAGE_COLORS.partial

      const icon = L.divIcon({
        html: `<div style="
          width:24px;height:24px;
          background:${color};
          border:2px solid white;
          border-radius:50%;
          box-shadow:0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize:   [24, 24],
        iconAnchor: [12, 12],
        className:  ''
      })

      const marker = L.marker([lat, lng], { icon })
      marker._rapida_damage = damage   // stored for iconCreateFunction
      marker.on('click', () => onMarkerClick(report))
      group.addLayer(marker)
    })

    map.addLayer(group)
    clusterGroupRef.current = group

    return () => { map.removeLayer(group) }
  }, [map, reports, onMarkerClick])

  return null
}

function MapBoundsUpdater({ reports }) {
  const map = useMap()

  useEffect(() => {
    if (reports.length === 0) return
    const valid = reports.filter((r) => r.geometry?.coordinates)
    if (valid.length === 0) return
    const bounds = L.latLngBounds(valid.map((r) => [r.geometry.coordinates[1], r.geometry.coordinates[0]]))
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [reports, map])

  return null
}

function LiveBadge({ lastRefresh, refreshing }) {
  const [, tick] = useState(0)

  // Re-render every 15 s so the "Xm ago" label stays fresh
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const { label, kind } = liveStatus(lastRefresh, refreshing)

  return (
    <div className={`
      absolute top-2 right-2 z-[1000]
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-md
      select-none pointer-events-none
      ${kind === 'live' ? 'bg-white text-emerald-700 border border-emerald-200' :
        kind === 'updating' ? 'bg-white text-gray-500 border border-gray-200' :
        'bg-white text-gray-500 border border-gray-200'}
    `}>
      {kind === 'live' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {kind === 'updating' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
        </span>
      )}
      {kind === 'stale' && (
        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
      )}
      {label}
    </div>
  )
}

function AnalystActions({ reportId, isVerified, analystNotes, apiKey }) {
  const [verified, setVerified] = useState(isVerified)
  const [notes, setNotes] = useState(analystNotes || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function toggleVerify() {
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ is_verified: !verified })
      })
      if (res.ok) setVerified(v => !v)
    } finally { setSaving(false) }
  }

  async function saveNotes() {
    setSaving(true)
    try {
      await fetch(`/api/v1/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ analyst_notes: notes })
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="border-t border-gray-100 pt-2 mt-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Analyst Actions</p>

      {/* Verify toggle */}
      <button
        onClick={toggleVerify}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold mb-2 transition-colors ${
          verified
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
        }`}
      >
        {verified ? '✓ Verified' : '○ Mark as Verified'}
      </button>

      {/* Notes */}
      {editing ? (
        <div className="space-y-1">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Add analyst note…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-undp-blue"
          />
          <div className="flex gap-1">
            <button onClick={saveNotes} disabled={saving}
              className="flex-1 py-1 bg-undp-blue text-white text-xs rounded-lg font-medium">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-full text-left px-2 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
          {notes || '+ Add analyst note…'}
        </button>
      )}
    </div>
  )
}

function BuildingAggregateLayer({ apiKey, visible }) {
  const map = useMap()
  const groupRef = useRef(null)

  useEffect(() => {
    if (!visible) {
      if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null }
      return
    }

    fetch('/api/v1/analytics/buildings', {
      headers: { 'X-API-Key': apiKey }
    })
      .then(r => r.json())
      .then(buildings => {
        if (groupRef.current) map.removeLayer(groupRef.current)
        const group = L.layerGroup()

        buildings.forEach(b => {
          if (!b.lat || !b.lng) return
          const dmgColor = b.current_damage_level === 'complete' ? '#D12800'
            : b.current_damage_level === 'partial' ? '#F5A623' : '#00833E'
          const size = Math.min(40, 16 + b.report_count * 4)

          const marker = L.marker([b.lat, b.lng], {
            icon: L.divIcon({
              html: `<div style="
                width:${size}px;height:${size}px;
                background:${dmgColor};
                border:3px solid white;
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                color:white;font-weight:bold;font-size:${size > 24 ? 11 : 9}px;
                box-shadow:0 2px 6px rgba(0,0,0,0.4);
              ">${b.report_count}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              className: ''
            })
          })
          marker.bindPopup(`
            <div style="min-width:160px">
              <strong>${b.report_count} reports</strong><br/>
              Damage: <span style="color:${dmgColor};font-weight:bold">${b.current_damage_level}</span><br/>
              Last report: ${new Date(b.last_reported_at).toLocaleDateString()}
            </div>
          `)
          group.addLayer(marker)
        })

        map.addLayer(group)
        groupRef.current = group
      })
      .catch(() => {})

    return () => { if (groupRef.current) map.removeLayer(groupRef.current) }
  }, [map, visible, apiKey])

  return null
}

function ReportPopup({ report, onClose, onFlag, flagging, flagged, apiKey, t }) {
  const props = report.properties || {}
  const damage = props.damage_level || 'partial'
  const bgClass = DAMAGE_BG[damage] || DAMAGE_BG.partial
  const emoji = DAMAGE_EMOJI[damage] || '⚠️'
  const hasPhoto = !!props.photo_url

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 max-w-xs mx-auto" style={{ minWidth: 220 }}>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Thumbnail / placeholder */}
        <div className="relative">
          {hasPhoto ? (
            <img
              src={props.photo_url}
              alt="Damage photo"
              className="w-full object-cover rounded-t-xl bg-gray-100"
              style={{ height: 120 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center bg-gray-100 rounded-t-xl text-4xl"
              style={{ height: 120 }}
              aria-hidden="true"
            >
              {emoji}
            </div>
          )}

          {/* Damage badge over thumbnail */}
          <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white ${bgClass}`}>
            {emoji} {damage.charAt(0).toUpperCase() + damage.slice(1)}
          </span>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full text-sm leading-none transition-colors"
            aria-label={t('close')}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          {/* Infra + crisis type */}
          <div className="flex items-center gap-1 text-xs text-gray-500 font-medium mb-1">
            {props.infrastructure_type && (
              <span>🏗️ {props.infrastructure_type}</span>
            )}
            {props.infrastructure_type && props.crisis_type && (
              <span className="text-gray-300">·</span>
            )}
            {props.crisis_type && (
              <span>⚠️ {props.crisis_type}</span>
            )}
          </div>

          {/* Time ago */}
          {props.created_at && (
            <p className="text-xs text-gray-400 mb-2">{timeAgo(props.created_at)}</p>
          )}

          {/* Description */}
          {props.description && (
            <p className="text-xs text-gray-700 mb-3 line-clamp-2 leading-relaxed">
              {props.description}
            </p>
          )}

          {/* Confirmation count badge */}
          {props.confirmation_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-undp-teal font-semibold mb-2">
              <span>👍</span>
              <span>{props.confirmation_count} {props.confirmation_count === 1 ? 'person' : 'people'} confirmed this</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2">
            {props.id && (
              <a
                href={`/reports/${props.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-semibold text-white bg-[#0468B1] hover:bg-blue-700 py-2 px-3 rounded-lg transition-colors"
              >
                View full report →
              </a>
            )}
            <button
              onClick={onFlag}
              disabled={flagging || flagged}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-colors
                ${flagged ? 'border-gray-200 text-gray-400 bg-gray-50' : 'border-red-500 text-red-500 hover:bg-red-50'}`}
              title={t('flag_report')}
            >
              {flagged ? '✓' : '🚩'}
            </button>
          </div>

          {/* Analyst actions — only rendered when an API key is available */}
          {apiKey && props.id && (
            <AnalystActions
              reportId={props.id}
              isVerified={props.is_verified}
              analystNotes={props.analyst_notes}
              apiKey={apiKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function MapView({ reports, loading, refreshing, lastRefresh, showHeatmap, showNeedsHeatmap, needsHeatmapType, showBuildings, showBuildingAggregate, showConsolidated, apiKey, flyTarget }) {
  const { t } = useTranslation()
  const sessionId = useStore((s) => s.sessionId)
  const [selectedReport, setSelectedReport] = useState(null)
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)

  const handleMarkerClick = useCallback((report) => {
    setSelectedReport(report)
    setFlagged(false)
  }, [])

  const handleFlag = async () => {
    if (!selectedReport) return
    setFlagging(true)
    try {
      await flagReport(selectedReport.properties?.id, sessionId)
      setFlagged(true)
    } catch {
      // silent
    } finally {
      setFlagging(false)
    }
  }

  const mapReports = (showNeedsHeatmap && needsHeatmapType && needsHeatmapType !== 'all')
    ? reports.filter(r => {
        const needs = r.properties?.pressing_needs
        return Array.isArray(needs) && needs.includes(needsHeatmapType)
      })
    : reports

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-xl">
          <LoadingSpinner size="lg" label={t('loading')} />
        </div>
      )}

      <LiveBadge lastRefresh={lastRefresh} refreshing={refreshing} />

      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ width: '100%', height: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {reports.length > 0 && <MapBoundsUpdater reports={reports} />}

        {showHeatmap ? (
          <HeatmapLayer reports={mapReports} />
        ) : (
          <ClusteredMarkers reports={mapReports} onMarkerClick={handleMarkerClick} />
        )}

        {showNeedsHeatmap && (
          <NeedsHeatmapLayer
            key={needsHeatmapType}
            reports={reports}
            needType={needsHeatmapType || 'all'}
          />
        )}

        {showConsolidated && <ConsolidatedLayer apiKey={apiKey} />}

        {showBuildings && <BuildingLayer />}

        <BuildingAggregateLayer apiKey={apiKey || ''} visible={!!showBuildingAggregate} />

        <FlyToHandler target={flyTarget} />
      </MapContainer>

      {selectedReport && (
        <ReportPopup
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onFlag={handleFlag}
          flagging={flagging}
          flagged={flagged}
          apiKey={apiKey || ''}
          t={t}
        />
      )}
    </div>
  )
}
