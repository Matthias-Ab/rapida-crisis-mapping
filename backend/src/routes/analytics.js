const router = require('express').Router()
const auth = require('../middleware/auth')
const { getAnalytics, getTimeseries, getTopAreas, getBuildingSummary } = require('../services/analytics')

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

router.get('/timeseries', async (req, res, next) => {
  try {
    const hours = Math.min(parseInt(req.query.hours || '48'), 168)
    res.json(await getTimeseries(hours))
  } catch (err) { next(err) }
})

router.get('/top-areas', async (req, res, next) => {
  try {
    res.json(await getTopAreas(parseInt(req.query.limit || '5')))
  } catch (err) { next(err) }
})

router.get('/buildings', auth, async (req, res, next) => {
  try {
    res.json(await getBuildingSummary())
  } catch (err) { next(err) }
})

module.exports = router
