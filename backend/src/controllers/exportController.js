const { Parser: Json2csvParser } = require('json2csv')
const { prisma } = require('../db/connection')

/**
 * Columns included in CSV export (no ip_hash, no session_id).
 */
const CSV_FIELDS = [
  { label: 'id', value: 'id' },
  { label: 'created_at', value: 'created_at' },
  { label: 'latitude', value: 'latitude' },
  { label: 'longitude', value: 'longitude' },
  { label: 'building_id', value: 'building_id' },
  { label: 'location_text', value: 'location_text' },
  { label: 'damage_level', value: 'damage_level' },
  { label: 'infra_type', value: 'infra_type' },
  { label: 'infra_name', value: 'infra_name' },
  { label: 'crisis_type', value: 'crisis_type' },
  { label: 'description', value: 'description' },
  { label: 'debris_present', value: 'debris_present' },
  { label: 'electricity_status', value: 'electricity_status' },
  { label: 'health_services_status', value: 'health_services_status' },
  { label: 'pressing_needs', value: 'pressing_needs' },
  { label: 'language', value: 'language' },
  { label: 'is_flagged', value: 'is_flagged' },
  { label: 'is_verified', value: 'is_verified' }
]

/**
 * Build a Prisma WHERE clause from shared query parameters.
 * Used by both CSV and GeoJSON export routes.
 */
function buildWhereClause(query) {
  const { bbox, damage_level, crisis_type, infra_type, from, to, flagged, verified } = query
  const where = {}

  if (damage_level) {
    const levels = damage_level.split(',').map(s => s.trim()).filter(Boolean)
    where.damageLevel = levels.length === 1 ? levels[0] : { in: levels }
  }

  if (crisis_type) {
    const types = crisis_type.split(',').map(s => s.trim()).filter(Boolean)
    where.crisisType = types.length === 1 ? types[0] : { in: types }
  }

  if (infra_type) {
    const types = infra_type.split(',').map(s => s.trim()).filter(Boolean)
    where.infraType = types.length === 1 ? types[0] : { in: types }
  }

  if (from || to) {
    where.createdAt = {}
    if (from) {
      const d = new Date(from)
      if (!isNaN(d.getTime())) where.createdAt.gte = d
    }
    if (to) {
      const d = new Date(to)
      if (!isNaN(d.getTime())) where.createdAt.lte = d
    }
  }

  if (flagged !== undefined) {
    where.isFlagged = flagged === 'true'
  }

  if (verified !== undefined) {
    where.isVerified = verified === 'true'
  }

  // bbox is handled separately via raw SQL; not applicable in Prisma where clause
  return { where, hasBbox: !!bbox, bboxParts: bbox ? bbox.split(',').map(Number) : null }
}

/**
 * Fetch reports using Prisma ORM (no bbox filtering — bbox requires raw SQL).
 * For bbox-filtered exports, falls back to $queryRaw.
 */
async function fetchReports(query) {
  const { where, hasBbox, bboxParts } = buildWhereClause(query)
  const limit = Math.min(parseInt(query.limit, 10) || 50000, 100000)
  const offset = parseInt(query.offset, 10) || 0

  if (!hasBbox) {
    const rows = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        buildingId: true,
        locationText: true,
        damageLevel: true,
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
        photoUrl: true,
        thumbnailUrl: true,
        what3words: true,
        aiDamageLevel: true,
        aiConfidence: true,
        duplicateOfId: true
      }
    })

    // Normalise field names to snake_case for export
    return rows.map(r => ({
      id: r.id,
      created_at: r.createdAt,
      latitude: r.latitude,
      longitude: r.longitude,
      building_id: r.buildingId,
      location_text: r.locationText,
      damage_level: r.damageLevel,
      infra_type: r.infraType,
      infra_name: r.infraName,
      crisis_type: r.crisisType,
      description: r.description,
      debris_present: r.debrisPresent,
      electricity_status: r.electricityStatus,
      health_services_status: r.healthServicesStatus,
      pressing_needs: Array.isArray(r.pressingNeeds) ? r.pressingNeeds.join('; ') : '',
      language: r.language,
      is_flagged: r.isFlagged,
      is_verified: r.isVerified,
      photo_url: r.photoUrl,
      thumbnail_url: r.thumbnailUrl,
      what3words: r.what3words,
      ai_damage_level: r.aiDamageLevel,
      ai_confidence: r.aiConfidence,
      duplicate_of: r.duplicateOfId
    }))
  }

  // Bbox path — use raw SQL with PostGIS ST_Within
  const [minLng, minLat, maxLng, maxLat] = bboxParts
  const conditions = []
  const params = [minLng, minLat, maxLng, maxLat]
  let pidx = 5

  if (where.damageLevel) {
    const lvls = typeof where.damageLevel === 'string' ? [where.damageLevel] : where.damageLevel.in
    const ph = lvls.map(() => `$${pidx++}`).join(', ')
    conditions.push(`damage_level IN (${ph})`)
    params.push(...lvls)
  }
  if (where.crisisType) {
    const types = typeof where.crisisType === 'string' ? [where.crisisType] : where.crisisType.in
    const ph = types.map(() => `$${pidx++}`).join(', ')
    conditions.push(`crisis_type IN (${ph})`)
    params.push(...types)
  }
  if (where.infraType) {
    const types = typeof where.infraType === 'string' ? [where.infraType] : where.infraType.in
    const ph = types.map(() => `$${pidx++}`).join(', ')
    conditions.push(`infra_type IN (${ph})`)
    params.push(...types)
  }
  if (where.createdAt?.gte) {
    conditions.push(`created_at >= $${pidx++}`)
    params.push(where.createdAt.gte)
  }
  if (where.createdAt?.lte) {
    conditions.push(`created_at <= $${pidx++}`)
    params.push(where.createdAt.lte)
  }
  if (where.isFlagged !== undefined) {
    conditions.push(`is_flagged = $${pidx++}`)
    params.push(where.isFlagged)
  }
  if (where.isVerified !== undefined) {
    conditions.push(`is_verified = $${pidx++}`)
    params.push(where.isVerified)
  }

  const extraWhere = conditions.length ? `AND ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)
  const limitPh = `$${pidx++}`
  const offsetPh = `$${pidx++}`

  const sql = `
    SELECT
      id::text, created_at, latitude, longitude, building_id, location_text,
      damage_level, infra_type, infra_name, crisis_type, description,
      debris_present, electricity_status, health_services_status,
      pressing_needs, language, is_flagged, is_verified,
      photo_url, thumbnail_url, what3words, ai_damage_level, ai_confidence,
      duplicate_of::text
    FROM reports
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
      ST_MakeEnvelope($1, $2, $3, $4, 4326)
    )
    ${extraWhere}
    ORDER BY created_at DESC
    LIMIT ${limitPh} OFFSET ${offsetPh}
  `

  const rows = await prisma.$queryRawUnsafe(sql, ...params)
  return rows.map(r => ({
    ...r,
    pressing_needs: Array.isArray(r.pressing_needs) ? r.pressing_needs.join('; ') : ''
  }))
}

/**
 * GET /api/v1/export/csv
 * Exports filtered reports as a CSV file.
 */
async function exportCSV(req, res, next) {
  try {
    const rows = await fetchReports(req.query)

    const parser = new Json2csvParser({ fields: CSV_FIELDS, defaultValue: '' })
    const csv = parser.parse(rows)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `rapida-reports-${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Total-Records', String(rows.length))
    return res.send(csv)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/export/geojson
 * Exports filtered reports as a GeoJSON FeatureCollection file.
 */
async function exportGeoJSON(req, res, next) {
  try {
    const rows = await fetchReports(req.query)

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
        damage_level: row.damage_level,
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
        what3words: row.what3words,
        ai_damage_level: row.ai_damage_level,
        ai_confidence: row.ai_confidence,
        duplicate_of: row.duplicate_of
      }
    }))

    const geojson = {
      type: 'FeatureCollection',
      features,
      metadata: {
        total: features.length,
        exported_at: new Date().toISOString(),
        source: 'RAPIDA Crisis Mapping Platform'
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `rapida-reports-${timestamp}.geojson`

    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Total-Records', String(features.length))
    return res.json(geojson)
  } catch (err) {
    next(err)
  }
}

module.exports = { exportCSV, exportGeoJSON }
