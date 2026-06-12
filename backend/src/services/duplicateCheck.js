const { prisma } = require('../db/connection')

/**
 * Checks whether a report is a duplicate of an existing report.
 *
 * A duplicate is defined as a report that:
 *  - Has the same building_id
 *  - Was submitted by the same session_id
 *  - Was created within the last 30 minutes
 *  - Is within 50 metres of the given coordinates (PostGIS ST_DWithin)
 *
 * Returns the id of the first matching duplicate, or null if none found.
 * Returns null immediately if buildingId is not provided (no reliable anchor).
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} buildingId
 * @param {string} sessionId
 * @returns {Promise<string|null>}
 */
async function checkDuplicate(latitude, longitude, buildingId, sessionId) {
  if (!buildingId) return null

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  // Uses PostGIS ST_DWithin with geography cast for accurate metre-based distance.
  // The reports table stores latitude/longitude as plain Float columns, so we
  // reconstruct the point inline. If the table gains a real geometry column in
  // a future migration this query should be updated to use it.
  const result = await prisma.$queryRaw`
    SELECT id::text
    FROM reports
    WHERE building_id = ${buildingId}
      AND session_id = ${sessionId}
      AND created_at > ${thirtyMinutesAgo}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        50
      )
    LIMIT 1
  `

  return result.length > 0 ? result[0].id : null
}

module.exports = { checkDuplicate }
