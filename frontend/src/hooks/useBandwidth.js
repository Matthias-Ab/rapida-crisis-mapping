import { useState, useEffect } from 'react'

const getConn = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection

export function useBandwidth() {
  const [isLow, setIsLow] = useState(() => {
    const conn = getConn()
    if (!conn) return false
    return ['slow-2g', '2g'].includes(conn.effectiveType) || conn.saveData === true
  })

  useEffect(() => {
    const conn = getConn()
    if (!conn) return

    const check = () => {
      setIsLow(['slow-2g', '2g'].includes(conn.effectiveType) || conn.saveData === true)
    }
    conn.addEventListener('change', check)
    return () => conn.removeEventListener('change', check)
  }, [])

  return isLow
}

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
