import Dexie from 'dexie'

const db = new Dexie('RapidaOfflineDB')
db.version(1).stores({
  offlineQueue: '++id, created_at, status, retry_count'
})

export async function addToQueue(formData, photoBlob) {
  return db.offlineQueue.add({
    created_at: new Date(),
    formData,
    photoBlob: photoBlob || null,
    status: 'pending',
    retry_count: 0,
    error: null
  })
}

export async function getPendingItems() {
  return db.offlineQueue.where('status').anyOf(['pending', 'failed']).toArray()
}

export async function updateItemStatus(id, status, error = null) {
  return db.offlineQueue.update(id, { status, error, updated_at: new Date() })
}

export async function removeItem(id) {
  return db.offlineQueue.delete(id)
}

export async function getPendingCount() {
  return db.offlineQueue.where('status').anyOf(['pending', 'failed']).count()
}

export async function getAllItems() {
  return db.offlineQueue.toArray()
}

export async function clearCompleted() {
  return db.offlineQueue.where('status').equals('synced').delete()
}

export default db
