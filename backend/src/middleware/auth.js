/**
 * API key authentication middleware.
 * Checks X-API-Key header against DASHBOARD_API_KEY env var.
 * Returns 401 if missing or incorrect.
 */
const auth = (req, res, next) => {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }
  next()
}

module.exports = auth
