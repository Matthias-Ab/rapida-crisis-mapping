const router = require('express').Router()
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { body, query, param } = require('express-validator')
const auth = require('../middleware/auth')
const { createReport, getReports, getReport, flagReport } = require('../controllers/reportController')

// Store uploads in memory so Sharp can process the buffer directly
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// 10 submissions per session / hour
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  // session_id arrives in the multipart body; multer runs before this but
  // express-rate-limit's keyGenerator fires before the route handler.
  // We fall back to IP if session_id is absent at key-generation time.
  keyGenerator: (req) => {
    const sid = (req.body && req.body.session_id) || req.ip
    return `submit:${sid}`
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions', code: 'SUBMISSION_RATE_LIMITED' },
  skip: (req) => req.method !== 'POST'
})

// 5 flags per IP / hour
const flagLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `flag:${req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many flags', code: 'FLAG_RATE_LIMITED' }
})

// -------------------------------------------------------------------
// POST /api/v1/reports  — public, rate-limited, requires photo upload
// -------------------------------------------------------------------
router.post(
  '/',
  submissionLimiter,
  upload.single('photo'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('latitude must be between -90 and 90'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('longitude must be between -180 and 180'),
    body('damage_level')
      .isIn(['none', 'partial', 'complete'])
      .withMessage('damage_level must be none, partial, or complete'),
    body('infra_type')
      .isIn(['residential', 'commercial', 'government', 'utility', 'transport_communication', 'community', 'public_recreation', 'other'])
      .withMessage('infra_type is not valid'),
    body('crisis_type')
      .isIn(['earthquake', 'flood', 'tsunami', 'hurricane_cyclone', 'wildfire', 'explosion', 'chemical_incident', 'conflict', 'civil_unrest'])
      .withMessage('crisis_type is not valid'),
    body('session_id').isUUID().withMessage('session_id must be a valid UUID'),
    body('description')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 500 }).withMessage('description must not exceed 500 characters')
      .trim()
      .escape()
  ],
  createReport
)

// -------------------------------------------------------------------
// GET /api/v1/reports  — auth-protected, returns GeoJSON
// -------------------------------------------------------------------
router.get(
  '/',
  auth,
  [
    query('bbox')
      .optional()
      .matches(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/)
      .withMessage('bbox must be minLng,minLat,maxLng,maxLat'),
    query('limit').optional().isInt({ min: 1, max: 5000 }).withMessage('limit must be 1–5000'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0'),
    query('damage_level').optional().isString(),
    query('crisis_type').optional().isString(),
    query('infra_type').optional().isString(),
    query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date'),
    query('flagged').optional().isIn(['true', 'false']),
    query('verified').optional().isIn(['true', 'false'])
  ],
  getReports
)

// -------------------------------------------------------------------
// GET /api/v1/reports/:id  — public (no sensitive fields returned)
// -------------------------------------------------------------------
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  getReport
)

// -------------------------------------------------------------------
// POST /api/v1/reports/:id/flag  — public, rate-limited
// -------------------------------------------------------------------
router.post(
  '/:id/flag',
  flagLimiter,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  flagReport
)

module.exports = router
