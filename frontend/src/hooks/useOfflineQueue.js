import { useState, useEffect, useCallback } from 'react'
import {
  getPendingCount,
  getPendingItems,
  updateItemStatus,
  removeItem
} from '../services/offlineDB'
import { submitReport } from '../services/api'
import { useStore } from '../store'

export function useOfflineQueue() {
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState(null)
  const setOfflineCount = useStore((s) => s.setOfflineCount)

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setQueueCount(count)
      setOfflineCount(count)
    } catch (err) {
      console.warn('Failed to refresh queue count:', err)
    }
  }, [setOfflineCount])

  const sync = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return

    setIsSyncing(true)
    setLastSyncResult(null)

    let succeeded = 0
    let failed = 0

    try {
      const items = await getPendingItems()

      for (const item of items) {
        try {
          await updateItemStatus(item.id, 'syncing')
          const fd = new FormData()

          if (item.formData && typeof item.formData === 'object') {
            Object.entries(item.formData).forEach(([k, v]) => {
              if (v !== null && v !== undefined) fd.append(k, v)
            })
          }

          if (item.photoBlob) {
            fd.append('photo', item.photoBlob, 'photo.jpg')
          }

          await submitReport(fd)
          await removeItem(item.id)
          succeeded++
        } catch (err) {
          const retryCount = (item.retry_count || 0) + 1
          await updateItemStatus(
            item.id,
            retryCount >= 5 ? 'failed_permanent' : 'failed',
            err.message || 'Sync failed'
          )
          failed++
        }
      }

      setLastSyncResult({ succeeded, failed, total: items.length })
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      await refreshCount()
      setIsSyncing(false)
    }
  }, [isSyncing, refreshCount])

  useEffect(() => {
    refreshCount()

    const handleOnline = () => {
      sync()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshCount, sync])

  return {
    queueCount,
    isSyncing,
    sync,
    refreshCount,
    lastSyncResult
  }
}
