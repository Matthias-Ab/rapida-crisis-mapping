const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { Prisma } = require('@prisma/client')
const { validationResult } = require('express-validator')
const { prisma } = require('../db/connection')
const { processAndUploadPhoto, processAndUploadThumbnail } = require('../services/storage')
const { checkDuplicate } = require('../services/duplicateCheck')
const { refreshMaterializedView } = require('../services/analytics')

/**
 * Hash an IP address with SHA-256 for privacy-preserving storage.
 * @param {string} ip
 * @returns {string}
 */
function hashIp(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.IP_HASH_SALT || ''))
    .digest('hex')
}

/**
 * POST /api/v1/reports
 * Accepts multipart/form-data with a required `photo` file field.
 * Validates, deduplicates, uploads photo, and inserts to DB.
 */
async function createReport(req, res, next) {
  try {
    // Validation errors from express-validator middleware
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(e => ({ field: e.path, message: e.msg }))
      })
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'A photo is required',
        code: 'MISSING_PHOTO'
      })
    }

    const {
      latitude,
      longitude,
      building_id,
      location_text,
      what3words,
      damage_level,
      infra_type,
      infra_name,
      crisis_type,
      description,
      debris_present,
      electricity_status,
      health_services_status,
      pressing_needs,
      session_id,
      language
    } = req.body

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)

    // Duplicate check — non-fatal, mark the new report as a duplicate if found
    const duplicateId = await checkDuplicate(lat, lng, building_id || null, session_id)

    // Upload full-resolution photo and thumbnail in parallel
    const [photoResult, thumbnailResult] = await Promise.all([
      processAndUploadPhoto(req.file.buffer),
      processAndUploadThumbnail(req.file.buffer)
    ])

    const ipHash = req.ip ? hashIp(req.ip) : null

    // Parse pressing_needs: may arrive as a JSON string or repeated form fields
    let parsedPressingNeeds = []
    if (pressing_needs) {
      if (Array.isArray(pressing_needs)) {
        parsedPressingNeeds = pressing_needs.map(String)
      } else {
        try {
          const parsed = JSON.parse(pressing_needs)
          parsedPressingNeeds = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
        } catch {
          parsedPressingNeeds = [String(pressing_needs)]
        }
      }
    }

    // Use raw INSERT to set PostGIS geometry column (coordinates) alongside
    // the scalar lat/lng fields — Prisma ORM cannot set geometry types.
    const reportId = uuidv4()
    const debrisPresent = debris_present != null
      ? (debris_present === 'true' || debris_present === true)
      : null

    await prisma.$executeRaw`
      INSERT INTO reports (
        id, latitude, longitude, coordinates,
        building_id, location_text, what3words,
        photo_url, photo_key, thumbnail_url,
        damage_level, infra_type, infra_name, crisis_type,
        description, debris_present, electricity_status, health_services_status,
        pressing_needs, session_id, ip_hash, language, duplicate_of
      ) VALUES (
        ${reportId}::uuid,
        ${lat}::float8, ${lng}::float8,
        ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326),
        ${building_id || null}, ${location_text || null}, ${what3words || null},
        ${photoResult.photoUrl}, ${photoResult.photoKey}, ${thumbnailResult.thumbnailUrl},
        ${damage_level}, ${infra_type}, ${infra_name || null}, ${crisis_type},
        ${description || null}, ${debrisPresent},
        ${electricity_status || null}, ${health_services_status || null},
        ${parsedPressingNeeds}, ${session_id}, ${ipHash},
        ${language || 'en'},
        ${duplicateId ? Prisma.sql`${duplicateId}::uuid` : Prisma.sql`NULL::uuid`}
      )
    `
    const report = { id: reportId, createdAt: new Date(), photoUrl: photoResult.photoUrl, thumbnailUrl: thumbnailResult.thumbnailUrl }

    // Async refresh — fire and forget, no await
    setImmediate(() => refreshMaterializedView().catch(() => {}))

    return res.status(201).json({
      id: report.id,
      created_at: report.createdAt,
      photo_url: report.photoUrl,
      thumbnail_url: report.thumbnailUrl,
      is_duplicate: !!duplicateId,
      duplicate_of: duplicateId || null
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reports
 * Returns a GeoJSON FeatureCollection.
 * Query params: bbox, damage_level, crisis_type, infra_type, from, to, limit, offset, flagged, verified
 */
async function getReports(req, res, next) {
  try {
    const {
      bbox,
      damage_level,
      crisis_type,
      infra_type,
      from,
      to,
      flagged,
      verified,
      limit = '1000',
      offset = '0'
    } = req.query

    const limitInt = Math.min(parseInt(limit, 10) || 1000, 5000)
    const offsetInt = parseInt(offset, 10) || 0

    // Build WHERE conditions dynamically
    const conditions = []
    const params = []
    let paramIdx = 1

    if (damage_level) {
      const levels = damage_level.split(',').map(s => s.trim()).filter(Boolean)
      if (levels.length === 1) {
        conditions.push(`damage_level = $${paramIdx++}`)
        params.push(levels[0])
      } else if (levels.length > 1) {
        const placeholders = levels.map(() => `$${paramIdx++}`).join(', ')
        conditions.push(`damage_level IN (${placeholders})`)
        params.push(...levels)
      }
    }

    if (crisis_type) {
      const types = crisis_type.split(',').map(s => s.trim()).filter(Boolean)
      if (types.length === 1) {
        conditions.push(`crisis_type = $${paramIdx++}`)
        params.push(types[0])
      } else if (types.length > 1) {
        const placeholders = types.map(() => `$${paramIdx++}`).join(', ')
        conditions.push(`crisis_type IN (${placeholders})`)
        params.push(...types)
      }
    }

    if (infra_type) {
      const types = infra_type.split(',').map(s => s.trim()).filter(Boolean)
      if (types.length === 1) {
        conditions.push(`infra_type = $${paramIdx++}`)
        params.push(types[0])
      } else if (types.length > 1) {
        const placeholders = types.map(() => `$${paramIdx++}`).join(', ')
        conditions.push(`infra_type IN (${placeholders})`)
        params.push(...types)
      }
    }

    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) {
        conditions.push(`created_at >= $${paramIdx++}`)
        params.push(fromDate)
      }
    }

    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) {
        conditions.push(`created_at <= $${paramIdx++}`)
        params.push(toDate)
      }
    }

    if (flagged !== undefined) {
      conditions.push(`is_flagged = $${paramIdx++}`)
      params.push(flagged === 'true')
    }

    if (verified !== undefined) {
      conditions.push(`is_verified = $${paramIdx++}`)
      params.push(verified === 'true')
    }

    let bboxCondition = ''
    let bboxMinLng, bboxMinLat, bboxMaxLng, bboxMaxLat

    if (bbox) {
      const parts = bbox.split(',').map(Number)
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        [bboxMinLng, bboxMinLat, bboxMaxLng, bboxMaxLat] = parts
        bboxCondition = `AND ST_Within(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
          ST_MakeEnvelope($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, 4326)
        )`
        paramIdx += 4
        params.push(bboxMinLng, bboxMinLat, bboxMaxLng, bboxMaxLat)
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} ${bboxCondition}`
      : bboxCondition ? `WHERE 1=1 ${bboxCondition}` : ''

    // Total count for the filtered result set
    const countQuery = `SELECT COUNT(*)::int AS count FROM reports ${whereClause}`
    const limitParam = `$${paramIdx++}`
    const offsetParam = `$${paramIdx++}`
    params.push(limitInt, offsetInt)

    const dataQuery = `
      SELECT
        id::text,
        created_at,
        latitude,
        longitude,
        building_id,
        location_text,
        what3words,
        thumbnail_url,
        damage_level,
        ai_damage_level,
        ai_confidence,
        infra_type,
        infra_name,
        crisis_type,
        description,
        debris_present,
        electricity_status,
        health_services_status,
        pressing_needs,
        language,
        is_flagged,
        is_verified,
        duplicate_of::text
      FROM reports
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `

    // Run count and data queries in parallel
    const [countResult, rows] = await Promise.all([
      prisma.$queryRawUnsafe(countQuery, ...params.slice(0, params.length - 2)),
      prisma.$queryRawUnsafe(dataQuery, ...params)
    ])

    const totalCount = countResult[0]?.count ?? 0

    const features = rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude]
      },
      properties: {
        id: row.id,
        created_at: row.created_at,
        building_id: row.building_id,
        location_text: row.location_text,
        what3words: row.what3words,
        thumbnail_url: row.thumbnail_url,
        damage_level: row.damage_level,
        ai_damage_level: row.ai_damage_level,
        ai_confidence: row.ai_confidence,
        infra_type: row.infra_type,
        infra_name: row.infra_name,
        crisis_type: row.crisis_type,
        description: row.description,
        debris_present: row.debris_present,
        electricity_status: row.electricity_status,
        health_services_status: row.health_services_status,
        pressing_needs: row.pressing_needs,
        language: row.language,
        is_flagged: row.is_flagged,
        is_verified: row.is_verified,
        duplicate_of: row.duplicate_of
      }
    }))

    return res.json({
      type: 'FeatureCollection',
      features,
      total: totalCount,
      returned: features.length,
      bbox_filtered: !!bbox,
      limit: limitInt,
      offset: offsetInt
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reports/:id
 * Returns full detail for a single report (excludes ip_hash and session_id).
 */
async function getReport(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid report ID',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(e => ({ field: e.path, message: e.msg }))
      })
    }

    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        latitude: true,
        longitude: true,
        buildingId: true,
        locationText: true,
        what3words: true,
        photoUrl: true,
        thumbnailUrl: true,
        damageLevel: true,
        aiDamageLevel: true,
        aiConfidence: true,
        infraType: true,
        infraName: true,
        crisisType: true,
        description: true,
        debrisPresent: true,
        electricityStatus: true,
        healthServicesStatus: true,
        pressingNeeds: true,
        language: true,
        isFlagged: true,
        isVerified: true,
        duplicateOfId: true
        // ip_hash and session_id intentionally excluded
      }
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' })
    }

    return res.json({
      id: report.id,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      latitude: report.latitude,
      longitude: report.longitude,
      building_id: report.buildingId,
      location_text: report.locationText,
      what3words: report.what3words,
      photo_url: report.photoUrl,
      thumbnail_url: report.thumbnailUrl,
      damage_level: report.damageLevel,
      ai_damage_level: report.aiDamageLevel,
      ai_confidence: report.aiConfidence,
      infra_type: report.infraType,
      infra_name: report.infraName,
      crisis_type: report.crisisType,
      description: report.description,
      debris_present: report.debrisPresent,
      electricity_status: report.electricityStatus,
      health_services_status: report.healthServicesStatus,
      pressing_needs: report.pressingNeeds,
      language: report.language,
      is_flagged: report.isFlagged,
      is_verified: report.isVerified,
      duplicate_of: report.duplicateOfId
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/reports/:id/flag
 * Sets is_flagged=true on the report without requiring auth
 * (public crowdsourced flagging, rate-limited by IP/session).
 */
async function flagReport(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid report ID',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(e => ({ field: e.path, message: e.msg }))
      })
    }

    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: { id: true, isFlagged: true }
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' })
    }

    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data: { isFlagged: true },
      select: { id: true, isFlagged: true }
    })

    return res.json({
      id: updated.id,
      is_flagged: updated.isFlagged,
      message: 'Report has been flagged for review'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { createReport, getReports, getReport, flagReport }
