import { useState, useCallback, useRef } from 'react'

export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const watchIdRef = useRef(null)
  const bestAccuracyRef = useRef(Infinity)

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    stopWatching()
    setLoading(true)
    setError(null)
    bestAccuracyRef.current = Infinity

    // Phase 1: get a quick coarse fix first (no high accuracy requirement)
    // This resolves immediately on desktop via WiFi/IP.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        bestAccuracyRef.current = accuracy
        setPosition({ lat: latitude, lng: longitude, accuracy })
        setLoading(false)
        setError(null)

        // Phase 2: watch for a better fix (GPS refinement on mobile)
        // Stop once we get accuracy < 30m or after 20 seconds.
        const started = Date.now()
        watchIdRef.current = navigator.geolocation.watchPosition(
          (refined) => {
            const { latitude: lat2, longitude: lng2, accuracy: acc2 } = refined.coords
            if (acc2 < bestAccuracyRef.current) {
              bestAccuracyRef.current = acc2
              setPosition({ lat: lat2, lng: lng2, accuracy: acc2 })
            }
            if (acc2 < 30 || Date.now() - started > 20000) {
              stopWatching()
            }
          },
          () => stopWatching(), // ignore watch errors — we already have a coarse fix
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        )
      },
      (err) => {
        setLoading(false)
        if (err.code === 1) {
          setError('Location permission denied. Please enable location access in your browser settings.')
        } else if (err.code === 2) {
          setError('Location unavailable. Please try again or enter your location manually below.')
        } else {
          // Timeout on coarse fix — try without high accuracy as last resort
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
              setError(null)
            },
            () => setError('Could not determine your location. Please enter it manually below.'),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          )
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    )
  }, [stopWatching])

  const clearPosition = useCallback(() => {
    stopWatching()
    setPosition(null)
    setError(null)
  }, [stopWatching])

  return { position, error, loading, getPosition, clearPosition }
}
