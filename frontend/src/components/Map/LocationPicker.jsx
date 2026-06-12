import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { useGeolocation } from '../../hooks/useGeolocation'
import BuildingLayer from './BuildingLayer'
import LoadingSpinner from '../shared/LoadingSpinner'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const CUSTOM_ICON = L.divIcon({
  html: `<div style="
    width: 36px; height: 36px;
    background: #0468B1;
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  className: ''
})

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { 'User-Agent': 'RAPIDA-CrisisMapping/1.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.display_name || null
  } catch {
    return null
  }
}

// Get approximate map center from IP — used only for initial map pan when GPS denied
async function ipCenter() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const d = await res.json()
    if (d.latitude && d.longitude) return [d.latitude, d.longitude]
    return null
  } catch {
    return null
  }
}

function DraggableMarker({ position, onPositionChange }) {
  const markerRef = useRef(null)
  return (
    <Marker
      draggable
      eventHandlers={{ dragend() {
        const m = markerRef.current
        if (m) { const p = m.getLatLng(); onPositionChange(p.lat, p.lng) }
      }}}
      position={position}
      ref={markerRef}
      icon={CUSTOM_ICON}
    />
  )
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function MapUpdater({ center, zoom }) {
  const map = useMapEvents({})
  useEffect(() => { if (center) map.setView(center, zoom || map.getZoom()) }, [center, zoom, map])
  return null
}

const W3W_PATTERN = /^[a-zA-Z]+\.[a-zA-Z]+\.[a-zA-Z]+$/

export default function LocationPicker({ onLocationChange, initialPosition }) {
  const { t } = useTranslation()
  const { position: gpsPosition, error: gpsError, loading: gpsLoading, getPosition } = useGeolocation()
  const [markerPos, setMarkerPos] = useState(initialPosition || null)
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [textLocation, setTextLocation] = useState('')
  const [mapCenter, setMapCenter] = useState(initialPosition || [20, 0])
  const [mapZoom, setMapZoom] = useState(initialPosition ? 16 : 2)
  const geocodeTimer = useRef(null)
  const ipFetched = useRef(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchDebounceRef = useRef(null)
  const searchInputRef = useRef(null)
  const dropdownRef = useRef(null)

  // What3words state
  const [w3wValue, setW3wValue] = useState('')
  const [w3wError, setW3wError] = useState('')

  // When GPS fails, pan the map to IP-based location so the user isn't staring at the world
  useEffect(() => {
    if (gpsError && !markerPos && !ipFetched.current) {
      ipFetched.current = true
      ipCenter().then((center) => {
        if (center) {
          setMapCenter(center)
          setMapZoom(12)
        }
      })
    }
  }, [gpsError, markerPos])

  // When GPS position arrives, fly to it and drop the pin
  useEffect(() => {
    if (gpsPosition) {
      const pos = [gpsPosition.lat, gpsPosition.lng]
      setMarkerPos(pos)
      setMapCenter(pos)
      setMapZoom(17)
      triggerGeocode(gpsPosition.lat, gpsPosition.lng)
    }
  }, [gpsPosition])   // eslint-disable-line react-hooks/exhaustive-deps

  const triggerGeocode = useCallback(async (lat, lng) => {
    clearTimeout(geocodeTimer.current)
    setGeocoding(true)
    geocodeTimer.current = setTimeout(async () => {
      const addr = await reverseGeocode(lat, lng)
      setAddress(addr || '')
      setGeocoding(false)
      onLocationChange?.(lat, lng, selectedBuilding, addr || textLocation, w3wValue)
    }, 400)
  }, [selectedBuilding, textLocation, w3wValue, onLocationChange])

  const handlePositionChange = useCallback((lat, lng) => {
    setMarkerPos([lat, lng])
    triggerGeocode(lat, lng)
  }, [triggerGeocode])

  const handleBuildingSelect = useCallback((osmId, geometry) => {
    setSelectedBuilding(osmId)
    if (geometry?.coordinates?.[0]) {
      const coords = geometry.coordinates[0]
      const lats = coords.map((c) => c[1])
      const lngs = coords.map((c) => c[0])
      const lat = (Math.min(...lats) + Math.max(...lats)) / 2
      const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      setMarkerPos([lat, lng])
      onLocationChange?.(lat, lng, osmId, address || textLocation, w3wValue)
    }
  }, [address, textLocation, w3wValue, onLocationChange])

  const handleTextChange = (e) => {
    setTextLocation(e.target.value)
    if (markerPos) onLocationChange?.(markerPos[0], markerPos[1], selectedBuilding, e.target.value, w3wValue)
  }

  // Forward geocoding search with 600ms debounce
  const handleSearchInput = useCallback((e) => {
    const q = e.target.value
    setSearchQuery(q)
    setActiveIndex(-1)

    if (!q.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      setSearchLoading(false)
      clearTimeout(searchDebounceRef.current)
      return
    }

    clearTimeout(searchDebounceRef.current)
    setSearchLoading(true)
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'User-Agent': 'RAPIDA-CrisisMapping/1.0' } }
        )
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setSearchResults(data)
        setShowDropdown(data.length > 0)
      } catch {
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setSearchLoading(false)
      }
    }, 600)
  }, [])

  const selectSearchResult = useCallback((result) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    setMarkerPos([lat, lng])
    setMapCenter([lat, lng])
    setMapZoom(17)
    setSearchQuery(result.display_name)
    setShowDropdown(false)
    setSearchResults([])
    setActiveIndex(-1)
    triggerGeocode(lat, lng)
  }, [triggerGeocode])

  const handleSearchKeyDown = useCallback((e) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && searchResults[activeIndex]) {
        selectSearchResult(searchResults[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }, [showDropdown, searchResults, activeIndex, selectSearchResult])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // What3words handlers
  const handleW3wChange = (e) => {
    setW3wValue(e.target.value)
    setW3wError('')
  }

  const handleW3wBlur = () => {
    if (!w3wValue.trim()) {
      setW3wError('')
      return
    }
    if (!W3W_PATTERN.test(w3wValue.trim())) {
      setW3wError(t('what3words_invalid') || 'Format must be word.word.word')
    } else {
      setW3wError('')
      if (markerPos) {
        onLocationChange?.(markerPos[0], markerPos[1], selectedBuilding, address || textLocation, w3wValue.trim())
      }
    }
  }

  const gpsPermissionDenied = gpsError?.includes('denied') || gpsError?.includes('permission')

  return (
    <div className="space-y-3">

      {/* Forward geocoding search */}
      <div className="relative">
        <div className="relative flex items-center">
          {/* Magnifying glass icon */}
          <span className="absolute left-3 text-gray-400 pointer-events-none z-10" aria-hidden="true">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
            placeholder={t('search_location') || 'Search for a place, street or landmark…'}
            className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-undp-blue"
            autoComplete="off"
            aria-label="Search for a location"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            role="combobox"
          />
          {/* Spinner inside input */}
          {searchLoading && (
            <span className="absolute right-3 pointer-events-none">
              <LoadingSpinner size="sm" color="gray" />
            </span>
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <ul
            ref={dropdownRef}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto"
          >
            {searchResults.map((result, idx) => (
              <li
                key={result.place_id}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); selectSearchResult(result) }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`px-4 py-2.5 text-sm cursor-pointer leading-snug transition-colors ${
                  idx === activeIndex ? 'bg-undp-blue text-white' : 'text-gray-800 hover:bg-blue-50'
                } ${idx !== searchResults.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                {result.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GPS button — hide if permission permanently denied (no point retrying) */}
      {!gpsPermissionDenied && (
        <button
          type="button"
          onClick={getPosition}
          disabled={gpsLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg font-semibold"
        >
          {gpsLoading ? (
            <><LoadingSpinner size="sm" color="white" /><span>{t('location_searching')}</span></>
          ) : (
            <><span aria-hidden="true">📍</span><span>{t('location_gps')}</span></>
          )}
        </button>
      )}

      {/* Error banner */}
      {gpsError && (
        <div className={`rounded-xl p-3 text-sm border ${gpsPermissionDenied ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-red-50 border-red-300 text-undp-red'}`}>
          {gpsPermissionDenied
            ? '🔒 Location access is blocked. Tap the map below to drop a pin on your location.'
            : '⚠️ ' + gpsError + ' Tap the map below to set your location.'}
        </div>
      )}

      {/* Map — always shown; tap-to-pin works without GPS */}
      <div className="relative">
        <div
          className="rounded-2xl overflow-hidden border-2 border-gray-200"
          style={{ height: '320px' }}
        >
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            <MapClickHandler onMapClick={handlePositionChange} />
            <BuildingLayer onBuildingSelect={handleBuildingSelect} />
            {markerPos && (
              <>
                <DraggableMarker position={markerPos} onPositionChange={handlePositionChange} />
                {gpsPosition?.accuracy && (
                  <Circle
                    center={markerPos}
                    radius={gpsPosition.accuracy}
                    pathOptions={{ color: '#0468B1', fillColor: '#0468B1', fillOpacity: 0.08, weight: 1, dashArray: '4' }}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>

        {/* Tap-to-pin overlay — only shown when no pin yet */}
        {!markerPos && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-2xl">
            <div className="bg-white/90 backdrop-blur-sm border-2 border-undp-blue rounded-2xl px-5 py-3 text-center shadow-lg">
              <p className="text-2xl mb-1">👆</p>
              <p className="font-bold text-undp-blue text-sm">Tap map to set location</p>
              <p className="text-xs text-gray-500 mt-0.5">or use the GPS button above</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected location card */}
      {markerPos && (
        <div className="bg-blue-50 border border-undp-blue/30 rounded-xl p-3 flex items-start gap-2">
          <span className="text-undp-blue text-lg flex-shrink-0">📍</span>
          <div className="flex-1 min-w-0">
            {geocoding ? (
              <p className="text-sm text-gray-500 italic">Looking up address…</p>
            ) : address ? (
              <p className="text-sm text-gray-800 leading-snug break-words font-medium">{address}</p>
            ) : (
              <p className="text-sm text-gray-500 font-mono">
                {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}
              </p>
            )}
            {gpsPosition?.accuracy && (
              <p className={`text-xs mt-1 ${gpsPosition.accuracy > 100 ? 'text-amber-600' : 'text-green-600'}`}>
                {gpsPosition.accuracy > 100
                  ? `⚠️ ±${Math.round(gpsPosition.accuracy)}m — GPS refining…`
                  : `✓ ±${Math.round(gpsPosition.accuracy)}m`}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMarkerPos(null); setAddress(''); onLocationChange?.(null, null, null, textLocation, w3wValue) }}
              className="text-xs text-gray-400 hover:text-undp-red mt-1 underline"
            >
              Clear pin
            </button>
          </div>
        </div>
      )}

      {/* Landmark description */}
      <div>
        <label htmlFor="text-location" className="block text-sm font-medium text-gray-700 mb-1">
          Landmark description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="text-location"
          type="text"
          value={textLocation}
          onChange={handleTextChange}
          placeholder="e.g. Near the blue mosque on main street"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-undp-blue"
        />
      </div>

      {/* What3words field */}
      <div>
        <label htmlFor="w3w-input" className="block text-sm font-medium text-gray-700 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span>{t('what3words_label') || 'What3words address'}</span>
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </label>
        <p className="text-xs text-gray-400 mb-1">(optional — format: word.word.word)</p>
        <input
          id="w3w-input"
          type="text"
          value={w3wValue}
          onChange={handleW3wChange}
          onBlur={handleW3wBlur}
          placeholder={t('what3words_placeholder') || 'e.g. filled.count.soap'}
          className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-undp-blue ${
            w3wError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
          }`}
        />
        {w3wError && (
          <p className="text-xs text-red-600 mt-1" role="alert">{w3wError}</p>
        )}
      </div>

      <p className="text-xs text-gray-400 flex gap-1">
        <span>🔒</span>
        <span>{t('location_permission')}</span>
      </p>
    </div>
  )
}
