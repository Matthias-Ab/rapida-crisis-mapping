import React, { useEffect, useState, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'

// ─── Module-level shared state ────────────────────────────────────────────────
// Shared across all component instances so multiple maps don't double-fire.
const cache = new Map()           // snappedKey -> GeoJSON
let inFlight = false              // only one request at a time
let backoffUntil = 0              // epoch ms — don't request before this
const BACKOFF_CODES = new Set([429, 503, 504])

// Snap a bbox to a coarse grid (≈0.5km cells) so minor pans reuse the cache.
function snapBbox(s, w, n, e) {
  const P = 3 // decimal places ≈ 111m per unit → 3dp ≈ 111m grid
  const snap = (v) => Math.round(v * 10 ** P) / 10 ** P
  return [snap(s), snap(w), snap(n), snap(e)]
}

function overpassToGeoJSON(data) {
  const nodes = {}
  data.elements.forEach((el) => {
    if (el.type === 'node') nodes[el.id] = [el.lon, el.lat]
  })
  const features = []
  data.elements.forEach((el) => {
    if (el.type !== 'way' || !el.nodes?.length) return
    const coords = el.nodes.map((id) => nodes[id]).filter(Boolean)
    if (coords.length < 3) return
    if (coords[0][0] !== coords.at(-1)[0] || coords[0][1] !== coords.at(-1)[1]) {
      coords.push(coords[0])
    }
    features.push({
      type: 'Feature',
      id: el.id,
      properties: { osmId: el.id, name: el.tags?.name || null },
      geometry: { type: 'Polygon', coordinates: [coords] }
    })
  })
  return { type: 'FeatureCollection', features }
}

async function fetchBuildings(south, west, north, east) {
  const [ss, sw, sn, se] = snapBbox(south, west, north, east)
  const key = `${ss},${sw},${sn},${se}`

  if (cache.has(key)) return cache.get(key)
  if (inFlight) return null
  if (Date.now() < backoffUntil) return null

  inFlight = true
  try {
    const query = `[out:json][timeout:15];(way["building"](${ss},${sw},${sn},${se}););out body;>;out skel qt;`
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(18000) }
    )

    if (BACKOFF_CODES.has(res.status)) {
      // Back off: 30s on first hit, capped at 2 min
      const current = Math.max(0, backoffUntil - Date.now())
      backoffUntil = Date.now() + Math.min(120000, Math.max(30000, current * 2))
      return null
    }
    if (!res.ok) return null

    const data = await res.json()
    const geojson = overpassToGeoJSON(data)
    cache.set(key, geojson)
    return geojson
  } catch {
    return null
  } finally {
    inFlight = false
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BuildingLayer({ onBuildingSelect }) {
  const map = useMap()
  const [geojson, setGeojson] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const geojsonRef = useRef(null)
  const timerRef = useRef(null)

  const load = React.useCallback(async () => {
    if (map.getZoom() < 16) { setGeojson(null); return }
    const b = map.getBounds()
    const data = await fetchBuildings(b.getSouth(), b.getWest(), b.getNorth(), b.getEast())
    if (data) setGeojson(data)
  }, [map])

  useEffect(() => {
    const schedule = () => {
      clearTimeout(timerRef.current)
      // 2s debounce — waits for the user to stop panning/zooming
      timerRef.current = setTimeout(load, 2000)
    }
    map.on('moveend', schedule)
    map.on('zoomend', schedule)
    load() // initial load
    return () => {
      map.off('moveend', schedule)
      map.off('zoomend', schedule)
      clearTimeout(timerRef.current)
    }
  }, [map, load])

  const styleFeature = (feature) => ({
    color: '#0468B1',
    weight: feature.id === selectedId ? 3 : 1,
    opacity: feature.id === selectedId ? 1 : 0.7,
    fillColor: '#0468B1',
    fillOpacity: feature.id === selectedId ? 0.3 : 0.1
  })

  const onEachFeature = (feature, layer) => {
    layer.on('click', () => {
      setSelectedId(feature.id)
      onBuildingSelect?.(feature.properties.osmId, feature.geometry)
      if (geojsonRef.current) {
        geojsonRef.current.resetStyle()
        layer.setStyle({ color: '#0468B1', weight: 3, fillColor: '#0468B1', fillOpacity: 0.3 })
      }
    })
    if (feature.properties.name) {
      layer.bindTooltip(feature.properties.name, { permanent: false, sticky: true })
    }
  }

  if (!geojson || geojson.features.length === 0) return null

  return (
    <GeoJSON
      key={geojson.features.length + String(selectedId)}
      ref={geojsonRef}
      data={geojson}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  )
}
