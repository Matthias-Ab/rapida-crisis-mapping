const { prisma } = require('../db/connection')

/**
 * Compute aggregated analytics across all reports.
 * All group-by queries run in parallel for performance.
 *
 * @returns {Promise<object>}
 */
async function getAnalytics() {
  const [
    total,
    byDamage,
    byInfra,
    byCrisis,
    last24h,
    last1h,
    buildings,
    flagged,
    verified
  ] = await Promise.all([
    prisma.report.count(),
    prisma.report.groupBy({ by: ['damageLevel'], _count: true }),
    prisma.report.groupBy({ by: ['infraType'], _count: true }),
    prisma.report.groupBy({ by: ['crisisType'], _count: true }),
    prisma.report.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    }),
    prisma.report.count({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }
    }),
    prisma.report.groupBy({
      by: ['buildingId'],
      where: { buildingId: { not: null } },
      _count: true
    }),
    prisma.report.count({ where: { isFlagged: true } }),
    prisma.report.count({ where: { isVerified: true } })
  ])

  return {
    total_reports: total,
    by_damage_level: Object.fromEntries(byDamage.map(r => [r.damageLevel, r._count])),
    by_infra_type: Object.fromEntries(byInfra.map(r => [r.infraType, r._count])),
    by_crisis_type: Object.fromEntries(byCrisis.map(r => [r.crisisType, r._count])),
    reports_last_24h: last24h,
    reports_last_1h: last1h,
    unique_buildings_affected: buildings.length,
    flagged_reports: flagged,
    verified_reports: verified
  }
}

/**
 * Refresh the building_damage_summary materialized view.
 * Attempts CONCURRENTLY first (allows reads during refresh); falls back to
 * a blocking refresh if the view has no unique index yet.
 * Errors are swallowed — callers should fire-and-forget.
 */
async function refreshMaterializedView() {
  try {
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY building_damage_summary`
  } catch {
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW building_damage_summary`
    } catch {
      // View may not exist in all environments; silently ignore
    }
  }
}

module.exports = { getAnalytics, refreshMaterializedView }
