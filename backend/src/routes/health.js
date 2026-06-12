const router = require('express').Router()
const { prisma } = require('../db/connection')
const Minio = require('minio')

/**
 * GET /api/v1/health
 * Liveness + readiness probe.
 * Returns 200 with component statuses even if dependencies are degraded,
 * so the caller can distinguish "app is up but DB is down" from "app is down".
 */
router.get('/', async (req, res) => {
  let dbStatus = 'disconnected'
  let storageStatus = 'disconnected'
  let dbLatencyMs = null

  // Database check
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - start
    dbStatus = 'connected'
  } catch {
    // swallow — status stays 'disconnected'
  }

  // MinIO check
  try {
    const minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    })
    await minioClient.bucketExists(process.env.MINIO_BUCKET || 'crisis-reports')
    storageStatus = 'connected'
  } catch {
    // swallow — status stays 'disconnected'
  }

  const allHealthy = dbStatus === 'connected' && storageStatus === 'connected'

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'ok' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    db: dbStatus,
    db_latency_ms: dbLatencyMs,
    storage: storageStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime())
  })
})

module.exports = router
