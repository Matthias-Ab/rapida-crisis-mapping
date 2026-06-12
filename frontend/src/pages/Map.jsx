import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { getReports } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import BuildingLayer from '../components/Map/BuildingLayer'

// Fix Leaflet icon
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

function ClusteredMarkersPublic({ reports }) {
  const mapRef = React.useRef(null)
  const clusterRef = React.useRef(null)

  React.useEffect(() => {
    if (!mapRef.current || !clusterRef.current) return
  }, [reports])

  return (
    <>
      {reports.map((report, idx) => {
        if (!report.geometry?.coordinates) return null
        const [lng, lat] = report.geometry.coordinates
        const damage = report.properties?.damage_level || 'partial'
        const color = DAMAGE_COLORS[damage] || DAMAGE_COLORS.partial

        return (
          <CircleMarker
            key={report.properties?.id || idx}
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.8,
              color: 'white',
              weight: 2
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold text-white mb-2
                  ${damage === 'complete' ? 'bg-undp-red' : damage === 'partial' ? 'bg-undp-amber' : 'bg-undp-green'}`}
                >
                  {damage}
                </div>
                {report.properties?.infrastructure_type && (
                  <p className="text-xs text-gray-600">{report.properties.infrastructure_type}</p>
                )}
                {report.properties?.crisis_type && (
                  <p className="text-xs text-gray-600">{report.properties.crisis_type}</p>
                )}
                {report.properties?.created_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(report.properties.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

export default function MapPage() {
  const { t } = useTranslation()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuildings, setShowBuildings] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getReports({ limit: 1000 })
      .then((res) => {
        setReports(res.data?.features || res.data || [])
      })
      .catch((err) => {
        if (err.response?.status !== 401) {
          setError('Could not load reports')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-undp-blue text-white px-4 py-3 flex items-center gap-3 shadow-md z-10 flex-shrink-0">
        <Link
          to="/submit"
          className="flex items-center gap-1.5 text-white/90 hover:text-white font-semibold text-sm active:scale-95 transition-all"
          aria-label={t('back')}
        >
          <svg className="w-5 h-5 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{t('back')}</span>
        </Link>

        <h1 className="font-bold text-base flex-1">{t('view_map')}</h1>

        <button
          onClick={() => setShowBuildings((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showBuildings ? 'bg-white text-undp-blue' : 'bg-white/20 hover:bg-white/30'}`}
        >
          {t('map_buildings')}
        </button>

        <LanguageSwitcher />
      </header>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-white rounded-xl shadow-lg p-3 flex flex-col gap-1.5 text-xs font-semibold">
        {Object.entries(DAMAGE_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white" style={{ backgroundColor: color, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
            <span className="capitalize text-gray-700">{t(`damage_${level}`)}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <main className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <LoadingSpinner size="lg" label={t('loading')} />
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-50 border border-undp-amber rounded-xl px-4 py-2 text-sm text-amber-700">
            {error}
          </div>
        )}

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
          <ClusteredMarkersPublic reports={reports} />
          {showBuildings && <BuildingLayer />}
        </MapContainer>
      </main>
    </div>
  )
}
