const { body, validationResult } = require('express-validator')

/**
 * Validation rules for POST /reports.
 * Checks all required fields and validates allowed enum values.
 */
const validateReport = [
  body('latitude')
    .notEmpty().withMessage('latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('latitude must be between -90 and 90'),

  body('longitude')
    .notEmpty().withMessage('longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('longitude must be between -180 and 180'),

  body('damage_level')
    .notEmpty().withMessage('damage_level is required')
    .isIn(['none', 'partial', 'complete'])
    .withMessage('damage_level must be none, partial, or complete'),

  body('infra_type')
    .notEmpty().withMessage('infra_type is required')
    .isIn(['residential', 'commercial', 'government', 'utility', 'transport_communication', 'community', 'public_recreation', 'other'])
    .withMessage('infra_type is not a valid value'),

  body('crisis_type')
    .notEmpty().withMessage('crisis_type is required')
    .isIn(['earthquake', 'flood', 'tsunami', 'hurricane_cyclone', 'wildfire', 'explosion', 'chemical_incident', 'conflict', 'civil_unrest'])
    .withMessage('crisis_type is not a valid value'),

  body('session_id')
    .notEmpty().withMessage('session_id is required')
    .isUUID().withMessage('session_id must be a valid UUID'),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }).withMessage('description must not exceed 500 characters')
    .trim()
    .escape(),

  body('location_text')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 200 }).withMessage('location_text must not exceed 200 characters')
    .trim()
    .escape(),

  body('what3words')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[a-z]+\.[a-z]+\.[a-z]+$/).withMessage('what3words must be three dot-separated words')
    .trim(),

  body('infra_name')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 200 }).withMessage('infra_name must not exceed 200 characters')
    .trim()
    .escape(),

  body('building_id')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 100 }).withMessage('building_id must not exceed 100 characters')
    .trim()
    .escape(),

  body('debris_present')
    .optional({ nullable: true })
    .isBoolean().withMessage('debris_present must be a boolean'),

  body('electricity_status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['on', 'off', 'unknown']).withMessage('electricity_status must be on, off, or unknown'),

  body('health_services_status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['operational', 'limited', 'closed', 'unknown']).withMessage('health_services_status is not a valid value'),

  body('pressing_needs')
    .optional({ nullable: true })
    .isArray().withMessage('pressing_needs must be an array'),

  body('pressing_needs.*')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .trim()
    .escape(),

  body('language')
    .optional({ checkFalsy: true })
    .isLength({ min: 2, max: 10 }).withMessage('language must be a valid language code')
    .trim()
]

/**
 * Sanitize middleware: runs after validateReport.
 * Returns 400 with validation errors if any field fails.
 */
const sanitizeReport = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    })
  }
  next()
}

module.exports = { validateReport, sanitizeReport }
