const router = require('express').Router()
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { body, query, param, validationResult } = require('express-validator')
const auth = require('../middleware/auth')
const { createReport, getReports, getReport, flagReport } = require('../controllers/reportController')
const { subscribe } = require('../services/broadcaster')

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

// GET /api/v1/reports/stream
router.get('/stream', (req, res) => {
  const key = req.query.key || req.headers['x-api-key']
  if (!key || key !== process.env.DASHBOARD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write('retry: 5000\n\n')
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date() })}\n\n`)

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`)
  }, 25000)

  const unsub = subscribe(({ event, data }) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  })

  req.on('close', () => { unsub(); clearInterval(heartbeat) })
})

// POST /api/v1/reports
router.post(
  '/',
  submissionLimiter,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'photo_2', maxCount: 1 },
    { name: 'photo_3', maxCount: 1 },
    { name: 'photo_4', maxCount: 1 },
    { name: 'photo_5', maxCount: 1 },
  ]),
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

// GET /api/v1/reports
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

router.get(
  '/:id',
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  getReport
)

const confirmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${req.params.id}`,
  message: { error: 'Already confirmed this report recently', code: 'ALREADY_CONFIRMED' }
})

router.post(
  '/:id/confirm',
  confirmLimiter,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed' })

      const { prisma } = require('../db/connection')
      const report = await prisma.report.update({
        where: { id: req.params.id },
        data: { confirmationCount: { increment: 1 } },
        select: { id: true, confirmationCount: true }
      })
      res.json({ id: report.id, confirmation_count: report.confirmationCount })
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Report not found' })
      next(err)
    }
  }
)

router.post(
  '/:id/flag',
  flagLimiter,
  [param('id').isUUID().withMessage('id must be a valid UUID')],
  flagReport
)

router.patch('/:id', auth, [
  param('id').isUUID(),
  body('is_verified').optional().isBoolean(),
  body('is_flagged').optional().isBoolean(),
  body('analyst_notes').optional().isString().isLength({ max: 1000 }).trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() })

    const { id } = req.params
    const { is_verified, is_flagged, analyst_notes } = req.body
    const { prisma } = require('../db/connection')

    const updates = {}
    if (is_verified !== undefined) {
      updates.isVerified = Boolean(is_verified)
      updates.verifiedAt = is_verified ? new Date() : null
    }
    if (is_flagged !== undefined) updates.isFlagged = Boolean(is_flagged)
    if (analyst_notes !== undefined) updates.analystNotes = analyst_notes

    const report = await prisma.report.update({ where: { id }, data: updates })
    res.json({ id: report.id, is_verified: report.isVerified, is_flagged: report.isFlagged, analyst_notes: report.analystNotes })
  } catch (err) { next(err) }
})

module.exports = router
