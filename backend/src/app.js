require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const { createLogger, transports, format } = require('winston')

// ---------------------------------------------------------------------------
// Logger (shared across the process)
// ---------------------------------------------------------------------------
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()]
})

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express()

// Trust the first proxy so req.ip is the client IP, not the proxy's address.
// Needed for accurate rate-limiting behind nginx / Docker ingress.
app.set('trust proxy', 1)

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : '*'

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Records'],
  credentials: allowedOrigins !== '*'
}
app.use(cors(corsOptions))

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ---------------------------------------------------------------------------
// Global IP rate limiter: 100 req/min per IP across all /api/ routes
// ---------------------------------------------------------------------------
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' }
}))

// ---------------------------------------------------------------------------
// Request logging (development only)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`)
    next()
  })
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/v1/reports', require('./routes/reports'))
app.use('/api/v1/export', require('./routes/export'))
app.use('/api/v1/analytics', require('./routes/analytics'))
app.use('/api/v1/health', require('./routes/health'))

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})

// ---------------------------------------------------------------------------
// Global error handler (must be last)
// ---------------------------------------------------------------------------
app.use(require('./middleware/errorHandler'))

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3001', 10)

async function startServer() {
  try {
    const { prisma } = require('./db/connection')
    await prisma.$connect()
    logger.info('Database connected')

    const { initializeBucket } = require('./services/storage')
    await initializeBucket()
    logger.info('MinIO bucket initialized')

    // Auto-seed demo data if the database is empty (first deploy / fresh DB)
    const { autoSeedIfEmpty } = require('../scripts/seed')
    await autoSeedIfEmpty(prisma)

    const server = app.listen(PORT, () => {
      logger.info(`RAPIDA backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
    })

    // ---------------------------------------------------------------------------
    // Graceful shutdown
    // ---------------------------------------------------------------------------
    async function shutdown(signal) {
      logger.info(`Received ${signal}, shutting down gracefully...`)
      server.close(async () => {
        try {
          await prisma.$disconnect()
          logger.info('Database disconnected')
        } catch (err) {
          logger.error('Error disconnecting from database:', err)
        }
        process.exit(0)
      })

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Forced shutdown after timeout')
        process.exit(1)
      }, 10000).unref()
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    return server
  } catch (err) {
    logger.error('Failed to start server:', { message: err.message, stack: err.stack })
    process.exit(1)
  }
}

startServer()

module.exports = app
