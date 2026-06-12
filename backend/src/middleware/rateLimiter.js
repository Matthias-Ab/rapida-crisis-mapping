/**
 * Session-based rate limiter: max 10 report submissions per session_id per hour.
 * Uses an in-memory Map with TTL cleanup to track request counts by session.
 * Falls back to IP if session_id is not present in the body.
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 10

// Map<key, { count: number, resetAt: number }>
const sessionStore = new Map()

// Cleanup expired entries every 10 minutes to prevent unbounded memory growth
const CLEANUP_INTERVAL = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of sessionStore.entries()) {
    if (now >= entry.resetAt) {
      sessionStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL).unref()

/**
 * Middleware factory that enforces per-session submission limits.
 */
function submissionLimiter(req, res, next) {
  // session_id may not be parsed yet if multer hasn't run; try both body and query
  const sessionId = (req.body && req.body.session_id) || req.query.session_id || req.ip
  const key = `session:${sessionId}`
  const now = Date.now()

  let entry = sessionStore.get(key)

  if (!entry || now >= entry.resetAt) {
    // First request in this window or window expired — reset
    entry = { count: 1, resetAt: now + WINDOW_MS }
    sessionStore.set(key, entry)
    return next()
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000)
    res.set('Retry-After', String(retryAfterSecs))
    return res.status(429).json({
      error: 'Too many submissions from this session',
      code: 'SUBMISSION_RATE_LIMITED',
      retryAfter: retryAfterSecs
    })
  }

  entry.count += 1
  return next()
}

module.exports = { submissionLimiter }
