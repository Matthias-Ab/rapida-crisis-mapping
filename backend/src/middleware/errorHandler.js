const { createLogger, transports, format } = require('winston')

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()]
})

/**
 * Global Express error handler. Must be registered last with app.use().
 * Logs all errors with Winston and returns a structured JSON response.
 */
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // Handle multer errors specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum size is 10MB.',
      code: 'FILE_TOO_LARGE'
    })
  }

  if (err.message === 'Invalid file type') {
    return res.status(415).json({
      error: 'Invalid file type. Only JPEG, PNG, and WebP images are accepted.',
      code: 'INVALID_FILE_TYPE'
    })
  }

  // Prisma known request errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with these details already exists.',
      code: 'DUPLICATE_RECORD'
    })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found.',
      code: 'NOT_FOUND'
    })
  }

  const status = err.status || err.statusCode || 500
  const isServerError = status >= 500

  if (isServerError) {
    logger.error(err.message, {
      stack: err.stack,
      path: req.path,
      method: req.method,
      code: err.code
    })
  } else {
    logger.warn(err.message, {
      path: req.path,
      method: req.method,
      status,
      code: err.code
    })
  }

  res.status(status).json({
    error: isServerError && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err.message || 'Internal server error'),
    code: err.code || 'INTERNAL_ERROR'
  })
}
