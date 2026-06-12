const router = require('express').Router()
const { query } = require('express-validator')
const auth = require('../middleware/auth')
const { exportCSV, exportGeoJSON } = require('../controllers/exportController')

// Shared query param validators for both export endpoints
const exportQueryValidators = [
  query('bbox')
    .optional()
    .matches(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/)
    .withMessage('bbox must be minLng,minLat,maxLng,maxLat'),
  query('damage_level').optional().isString(),
  query('crisis_type').optional().isString(),
  query('infra_type').optional().isString(),
  query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date'),
  query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date'),
  query('flagged').optional().isIn(['true', 'false']),
  query('verified').optional().isIn(['true', 'false']),
  query('limit').optional().isInt({ min: 1, max: 100000 }).withMessage('limit must be 1–100000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0')
]

/**
 * GET /api/v1/export/csv
 * Exports reports matching the filter criteria as a downloadable CSV.
 * Requires X-API-Key authentication.
 */
router.get('/csv', auth, exportQueryValidators, exportCSV)

/**
 * GET /api/v1/export/geojson
 * Exports reports matching the filter criteria as a downloadable GeoJSON file.
 * Requires X-API-Key authentication.
 */
router.get('/geojson', auth, exportQueryValidators, exportGeoJSON)

module.exports = router
