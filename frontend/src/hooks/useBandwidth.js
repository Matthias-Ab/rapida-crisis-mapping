import { useState, useEffect } from 'react'

/**
 * Detects slow network conditions via the Network Information API.
 * Returns true on 2G/slow-2g or when the browser data-saver flag is set.
 * Falls back to false on browsers that don't support the API.
 */
export function useBandwidth() {
  const [isLow, setIsLow] = useState(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!conn) return false
    return ['slow-2g', '2g'].includes(conn.effectiveType) || conn.saveData === true
  })

  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!conn) return

    const check = () => {
      setIsLow(['slow-2g', '2g'].includes(conn.effectiveType) || conn.saveData === true)
    }
    conn.addEventListener('change', check)
    return () => conn.removeEventListener('change', check)
  }, [])

  return isLow
}

/**
 * Compress an image File to max 800px / 60% JPEG quality.
 * Used automatically on low-bandwidth connections to reduce upload size ~5-10x.
 */
export async function compressImage(file, maxPx = 800, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
