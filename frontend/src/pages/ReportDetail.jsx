import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getReport, flagReport } from '../services/api'
import { useStore } from '../store'
import LoadingSpinner from '../components/shared/LoadingSpinner'

// Rewrite Docker-internal MinIO hostname to host-accessible URL
function publicMediaUrl(url) {
  if (!url) return null
  const minioPublic = import.meta.env.VITE_MINIO_PUBLIC_URL || 'http://localhost:9000'
  return url.replace(/https?:\/\/minio:\d+/, minioPublic)
}

const DAMAGE_CONFIG = {
  none:     { label: 'No / Minimal Damage',  color: '#00833E', bg: 'bg-green-50',  border: 'border-green-500',  icon: '✅' },
  partial:  { label: 'Partially Damaged',    color: '#F5A623', bg: 'bg-amber-50',  border: 'border-amber-500',  icon: '⚠️' },
  complete: { label: 'Completely Damaged',   color: '#D12800', bg: 'bg-red-50',    border: 'border-red-500',    icon: '🔴' },
}

const INFRA_LABELS = {
  residential: '🏠 Residential',
  commercial: '🏪 Commercial',
  government: '🏛️ Government',
  utility: '⚡ Utility',
  transport_communication: '🛣️ Transport & Communication',
  community: '🏫 Community',
  public_recreation: '🏟️ Public / Recreation',
  other: '❓ Other',
}

const CRISIS_LABELS = {
  earthquake: '🌍 Earthquake',
  flood: '🌊 Flood',
  tsunami: '🌊 Tsunami',
  hurricane_cyclone: '🌀 Hurricane / Cyclone',
  wildfire: '🔥 Wildfire',
  explosion: '💥 Explosion',
  chemical_incident: '☣️ Chemical Incident',
  conflict: '⚔️ Conflict',
  civil_unrest: '🚧 Civil Unrest',
}

const DAMAGE_MARKER = L.divIcon({
  html: '<div style="width:18px;height:18px;background:#F5A623;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
})

// Share icon SVG
function ShareIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

function ShareButton({ url, title }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard also unavailable — silently ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/20 transition-colors text-white text-sm font-medium"
      aria-label="Share report"
      title="Share report"
    >
      <ShareIcon className="w-5 h-5 flex-shrink-0" />
      {copied
        ? <span className="hidden sm:inline text-green-300 font-semibold">✓ Link copied!</span>
        : <span className="hidden sm:inline">Share</span>
      }
    </button>
  )
}

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const sessionId = useStore((s) => s.sessionId)

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flagged, setFlagged] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setLoading(true)
    getReport(id)
      .then((res) => {
        setReport(res.data)
        setFlagged(res.data.is_flagged)
      })
      .catch(() => setError('Report not found'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleFlag() {
    if (flagged || flagging) return
    setFlagging(true)
    try {
      await flagReport(id, sessionId)
      setFlagged(true)
    } catch {
      // silently ignore
    } finally {
      setFlagging(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <LoadingSpinner label="Loading report..." />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center">
      <div className="text-5xl">🔍</div>
      <h1 className="text-xl font-bold text-undp-red">Report not found</h1>
      <p className="text-gray-500 text-sm">{id}</p>
      <button onClick={() => navigate(-1)} className="px-6 py-2 bg-undp-blue text-white rounded-lg font-medium">
        Go back
      </button>
    </div>
  )

  const dmg = DAMAGE_CONFIG[report.damage_level] || DAMAGE_CONFIG.partial
  const photoUrl = publicMediaUrl(report.photo_url)
  const thumbUrl = publicMediaUrl(report.thumbnail_url)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-undp-blue text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm truncate">RAPIDA Report</h1>
          <p className="text-xs text-blue-200 truncate font-mono">{report.id}</p>
        </div>
        {report.is_verified && (
          <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
        )}
        {report.is_flagged && (
          <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-medium">⚑ Flagged</span>
        )}
        <ShareButton
          url={window.location.href}
          title={`RAPIDA Report – ${DAMAGE_CONFIG[report.damage_level]?.label}`}
        />
      </header>

      <div className="max-w-2xl mx-auto pb-10">
        {/* Photo */}
        <div className="bg-black relative">
          {!imgError && photoUrl ? (
            <img
              src={photoUrl}
              alt="Damage photo"
              className="w-full max-h-96 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-200">
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm">Photo unavailable</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pt-5 space-y-5">
          {/* Damage level badge */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${dmg.bg} ${dmg.border}`}>
            <span className="text-3xl">{dmg.icon}</span>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Damage Level</p>
              <p className="text-lg font-bold" style={{ color: dmg.color }}>{dmg.label}</p>
            </div>
            {report.ai_damage_level && (
              <div className="ms-auto text-right">
                <p className="text-xs text-gray-400">AI suggestion</p>
                <p className="text-sm font-medium text-gray-600">{DAMAGE_CONFIG[report.ai_damage_level]?.label}</p>
                {report.ai_confidence && (
                  <p className="text-xs text-gray-400">{Math.round(report.ai_confidence * 100)}% confidence</p>
                )}
              </div>
            )}
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Infrastructure" value={INFRA_LABELS[report.infra_type] || report.infra_type} />
            <Detail label="Crisis Type" value={CRISIS_LABELS[report.crisis_type] || report.crisis_type} />
            {report.infra_name && <Detail label="Facility Name" value={report.infra_name} />}
            {report.debris_present !== null && (
              <Detail label="Debris Present" value={report.debris_present ? 'Yes' : 'No'} />
            )}
            {report.electricity_status && <Detail label="Electricity" value={report.electricity_status} />}
            {report.health_services_status && <Detail label="Health Services" value={report.health_services_status} />}
            <Detail label="Language" value={report.language?.toUpperCase()} />
            <Detail label="Reported" value={new Date(report.created_at).toLocaleString()} />
          </div>

          {/* Pressing needs */}
          {report.pressing_needs?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide font-bold text-red-700 mb-2">Pressing Needs</p>
              <div className="flex flex-wrap gap-2">
                {report.pressing_needs.map((need) => (
                  <span key={need} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    {need}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {report.description && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide font-bold text-gray-500 mb-2">Description</p>
              <p className="text-gray-800 leading-relaxed">{report.description}</p>
            </div>
          )}

          {/* Location */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs uppercase tracking-wide font-bold text-gray-500 mb-1">Location</p>
              {report.location_text && (
                <p className="text-sm text-gray-700 mb-1">{report.location_text}</p>
              )}
              <p className="text-xs text-gray-400 font-mono">
                {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
              </p>
            </div>
            <div style={{ height: 220 }}>
              <MapContainer
                center={[report.latitude, report.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[report.latitude, report.longitude]} icon={DAMAGE_MARKER}>
                  <Popup>{dmg.icon} {dmg.label}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>

          {/* Flag button */}
          <button
            onClick={handleFlag}
            disabled={flagged || flagging}
            className={`w-full py-3 rounded-xl font-medium transition-colors border-2 ${
              flagged
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700 cursor-default'
                : 'bg-white border-gray-300 text-gray-600 hover:border-yellow-400 hover:text-yellow-700'
            }`}
          >
            {flagging ? 'Flagging...' : flagged ? '⚑ Flagged as inaccurate' : '⚑ Flag as inaccurate'}
          </button>

          {/* Privacy notice */}
          <p className="text-center text-xs text-gray-400 pb-2">
            Reports are anonymised. No personal data is collected.
          </p>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs uppercase tracking-wide font-bold text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}
