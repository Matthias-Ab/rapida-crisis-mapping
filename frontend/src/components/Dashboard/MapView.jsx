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

// ── Sub-components ────────────────────────────────────────────────────────────
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

function ClusteredMarkers({ reports, onMarkerClick }) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current)

    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true
    })

    reports.forEach((report) => {
      if (!report.geometry?.coordinates) return
      const [lng, lat] = report.geometry.coordinates
      const damage = report.properties?.damage_level || 'partial'
      const color = DAMAGE_COLORS[damage] || DAMAGE_COLORS.partial

      const icon = L.divIcon({
        html: `<div style="
          width:24px;height:24px;
          background:${color};
          border:2px solid white;
          border-radius:50%;
          box-shadow:0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: ''
      })

      const marker = L.marker([lat, lng], { icon })
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

// ── LIVE badge ────────────────────────────────────────────────────────────────
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

// ── Popup card ────────────────────────────────────────────────────────────────
function ReportPopup({ report, onClose, onFlag, flagging, flagged, t }) {
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
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MapView({ reports, loading, refreshing, lastRefresh, showHeatmap, showBuildings }) {
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
          <HeatmapLayer reports={reports} />
        ) : (
          <ClusteredMarkers
            reports={reports}
            onMarkerClick={handleMarkerClick}
          />
        )}

        {showBuildings && <BuildingLayer />}
      </MapContainer>

      {selectedReport && (
        <ReportPopup
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onFlag={handleFlag}
          flagging={flagging}
          flagged={flagged}
          t={t}
        />
      )}
    </div>
  )
}
