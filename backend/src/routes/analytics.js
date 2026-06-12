const router = require('express').Router()
const auth = require('../middleware/auth')
const { getAnalytics } = require('../services/analytics')

/**
 * GET /api/v1/analytics
 * Returns aggregated statistics across all reports.
 * Requires X-API-Key authentication.
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await getAnalytics()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

module.exports = router
