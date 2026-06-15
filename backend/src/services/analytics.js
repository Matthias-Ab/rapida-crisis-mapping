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

  const byDamageMap = Object.fromEntries(byDamage.map(r => [r.damageLevel, r._count]))

  return {
    total_reports: total,
    by_damage_level: byDamageMap,
    by_infra_type: Object.fromEntries(byInfra.map(r => [r.infraType, r._count])),
    by_crisis_type: Object.fromEntries(byCrisis.map(r => [r.crisisType, r._count])),
    reports_last_24h: last24h,
    reports_last_1h: last1h,
    unique_buildings_affected: buildings.length,
    flagged_reports: flagged,
    verified_reports: verified,
    // Urban crisis estimate: each complete-damage report ~100 people affected (building + neighbours);
    // partial-damage reports ~30 people. Weighted for urban contexts (Antakya, Derna, etc.)
    estimated_affected: Math.round((byDamageMap.complete || 0) * 100 + (byDamageMap.partial || 0) * 30)
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

async function getTimeseries(hours = 48) {
  const results = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('hour', created_at) AS hour,
      COUNT(*)::int AS total,
      SUM(CASE WHEN damage_level = 'none'     THEN 1 ELSE 0 END)::int AS none_count,
      SUM(CASE WHEN damage_level = 'partial'  THEN 1 ELSE 0 END)::int AS partial_count,
      SUM(CASE WHEN damage_level = 'complete' THEN 1 ELSE 0 END)::int AS complete_count
    FROM reports
    WHERE created_at > NOW() - INTERVAL '1 hour' * ${hours}
    GROUP BY DATE_TRUNC('hour', created_at)
    ORDER BY hour ASC
  `
  return results.map(r => ({
    hour: r.hour,
    total: r.total,
    none: r.none_count,
    partial: r.partial_count,
    complete: r.complete_count
  }))
}

async function getTopAreas(limit = 5) {
  const results = await prisma.$queryRaw`
    SELECT
      location_text,
      COUNT(*)::int AS report_count,
      SUM(CASE WHEN damage_level = 'complete' THEN 1 ELSE 0 END)::int AS complete_count,
      SUM(CASE WHEN damage_level = 'partial'  THEN 1 ELSE 0 END)::int AS partial_count,
      AVG(latitude)::float  AS lat,
      AVG(longitude)::float AS lng
    FROM reports
    WHERE location_text IS NOT NULL AND location_text != ''
      AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY location_text
    ORDER BY report_count DESC
    LIMIT ${limit}
  `
  return results
}

async function getBuildingSummary() {
  const results = await prisma.$queryRaw`
    SELECT
      building_id,
      report_count::int,
      last_reported_at,
      current_damage_level,
      avg_lat::float AS lat,
      avg_lng::float AS lng
    FROM building_damage_summary
    WHERE report_count >= 2
    ORDER BY report_count DESC
    LIMIT 100
  `
  return results
}

// Trend: compare last N hours vs previous N hours (% change)
async function getTrends(hours = 3) {
  const [current, previous] = await Promise.all([
    prisma.report.count({
      where: { createdAt: { gte: new Date(Date.now() - hours * 3600000) } }
    }),
    prisma.report.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 2 * hours * 3600000),
          lt:  new Date(Date.now() - hours * 3600000)
        }
      }
    })
  ])
  const pct = previous === 0 ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / previous) * 100)
  return { current, previous, change_pct: pct, hours }
}

// Priority: score reports by urgency = damage × infra_weight × recency_decay
// complete=100, partial=50, none=10
// utility/community/government = 1.5/1.4/1.3, others lower
// Decays exponentially over 48h
async function getPriorityReports(limit = 15) {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600000)
  const rows = await prisma.$queryRaw`
    SELECT
      id, damage_level, infra_type, crisis_type,
      location_text, description, thumbnail_url,
      pressing_needs, electricity_status, health_services_status,
      created_at, is_verified, latitude, longitude,
      EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS age_hours
    FROM reports
    WHERE created_at > ${cutoff}
      AND is_verified = false
    ORDER BY created_at DESC
    LIMIT 200
  `

  const DAMAGE_W  = { complete: 100, partial: 50, none: 10 }
  const INFRA_W   = {
    utility: 1.5, community: 1.4, government: 1.3,
    transport_communication: 1.2, residential: 1.0,
    commercial: 0.9, public_recreation: 0.8, other: 1.0
  }

  return rows
    .map(r => ({
      ...r,
      priority_score: Math.round(
        (DAMAGE_W[r.damage_level] || 50) *
        (INFRA_W[r.infra_type]   || 1.0) *
        Math.exp(-Number(r.age_hours) / 48) * 100
      ) / 100
    }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, limit)
}

// Situation report: full snapshot for one-click export
async function getSituationReport() {
  const [analytics, timeseries, topAreas, priorities, trends] = await Promise.all([
    getAnalytics(),
    getTimeseries(72),
    getTopAreas(10),
    getPriorityReports(20),
    getTrends(3)
  ])
  return {
    generated_at: new Date().toISOString(),
    analytics,
    timeseries,
    top_areas: topAreas,
    priority_reports: priorities,
    trends
  }
}

module.exports = { getAnalytics, refreshMaterializedView, getTimeseries, getTopAreas, getBuildingSummary, getTrends, getPriorityReports, getSituationReport }
