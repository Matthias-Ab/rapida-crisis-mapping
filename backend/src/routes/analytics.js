const router = require('express').Router()
const axios = require('axios')
const auth = require('../middleware/auth')
const { getAnalytics, getTimeseries, getTopAreas, getBuildingSummary, getTrends, getPriorityReports, getSituationReport } = require('../services/analytics')

// Shared Groq helper
async function callGroq(prompt, maxTokens = 400) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) throw Object.assign(new Error('AI not configured'), { code: 'NO_GROQ_KEY' })
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.3 },
    { headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  )
  return res.data.choices?.[0]?.message?.content || ''
}

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

router.get('/trends', async (req, res, next) => {
  try {
    const hours = Math.max(1, Math.min(parseInt(req.query.hours || '3'), 24))
    res.json(await getTrends(hours))
  } catch (err) { next(err) }
})

router.get('/priority', auth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '15'), 50)
    res.json(await getPriorityReports(limit))
  } catch (err) { next(err) }
})

router.get('/situation-report', auth, async (req, res, next) => {
  try {
    res.json(await getSituationReport())
  } catch (err) { next(err) }
})

// POST /api/v1/analytics/translate
// Translates arbitrary text (field report description) into a target UN language.
router.post('/translate', async (req, res, next) => {
  try {
    const { text, to = 'en' } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' })
    const SUPPORTED = ['en', 'fr', 'es', 'ar', 'zh', 'ru']
    if (!SUPPORTED.includes(to)) return res.status(400).json({ error: 'unsupported target language' })
    const LANG_NAMES = { en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic', zh: 'Simplified Chinese', ru: 'Russian' }
    const translated = await callGroq(
      `Translate the following crisis field report text to ${LANG_NAMES[to]}. Return ONLY the translation, no preamble:\n\n${text.slice(0, 1000)}`,
      400
    )
    res.json({ translated: translated.trim(), target_lang: to })
  } catch (err) {
    if (err.code === 'NO_GROQ_KEY') return res.status(503).json({ error: 'Translation not configured' })
    next(err)
  }
})

// GET /api/v1/analytics/alerts
// Detects mass incidents using PostGIS ST_ClusterDBSCAN (DBSCAN algorithm).
// eps=0.005 degrees ≈ 500m radius; minpoints=3. Accurate regardless of grid
// boundaries — a real incident straddling two 1km cells is always detected.
router.get('/alerts', async (req, res, next) => {
  try {
    const { prisma } = require('../db/connection')
    const clusters = await prisma.$queryRaw`
      SELECT
        cluster_id,
        COUNT(*)::int                     AS count,
        AVG(latitude)::float              AS lat,
        AVG(longitude)::float             AS lng,
        MIN(location_text)                AS location,
        ARRAY_AGG(DISTINCT crisis_type)   AS crisis_types,
        ARRAY_AGG(DISTINCT infra_type)    AS infra_types,
        MAX(created_at)                   AS latest_at
      FROM (
        SELECT
          id, latitude, longitude, location_text, crisis_type, infra_type, created_at,
          ST_ClusterDBSCAN(coordinates::geometry, eps := 0.0045, minpoints := 3)
            OVER () AS cluster_id
        FROM reports
        WHERE damage_level = 'complete'
          AND created_at > NOW() - INTERVAL '24 hours'
          AND coordinates IS NOT NULL
      ) sub
      WHERE cluster_id IS NOT NULL
      GROUP BY cluster_id
      ORDER BY count DESC
      LIMIT 5
    `
    res.json({
      alerts: clusters.map(c => ({
        count: c.count,
        lat: c.lat,
        lng: c.lng,
        location: c.location,
        crisis_types: c.crisis_types.filter(Boolean),
        infra_types: c.infra_types.filter(Boolean),
        latest_at: c.latest_at,
        severity: c.count >= 6 ? 'critical' : 'warning'
      })),
      checked_at: new Date().toISOString()
    })
  } catch (err) { next(err) }
})

// GET /api/v1/analytics/ai-insights
// Returns 3 short data-driven intelligence observations for dashboard analysts.
router.get('/ai-insights', auth, async (req, res, next) => {
  try {
    const [analytics, trends, topAreas] = await Promise.all([
      getAnalytics(), getTrends(3), getTopAreas(5)
    ])

    const trendDir = trends.change_pct > 5 ? 'INCREASING' : trends.change_pct < -5 ? 'DECREASING' : 'STABLE'
    const topAreasSummary = topAreas.slice(0, 3)
      .map(a => `${a.location_text} (${a.report_count} reports, ${Math.round((a.complete_count / a.report_count) * 100)}% severe)`)
      .join('; ')
    const crisisSummary = Object.entries(analytics.by_crisis_type || {})
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')

    const prompt = `You are a UNDP crisis response analyst. Based on this live crisis data, provide exactly 3 short, specific, actionable intelligence observations.

LIVE DATA:
- Total reports: ${analytics.total_reports} | Last 24h: ${analytics.reports_last_24h} | Last 1h: ${analytics.reports_last_1h}
- Trend (3h): ${trendDir} (${trends.change_pct}%)
- Damage: ${analytics.by_damage_level.complete || 0} complete, ${analytics.by_damage_level.partial || 0} partial, ${analytics.by_damage_level.none || 0} none
- Estimated people affected: ~${analytics.estimated_affected?.toLocaleString()}
- Top affected areas: ${topAreasSummary || 'No location data'}
- Primary crisis types: ${crisisSummary || 'No data'}

Respond with ONLY a valid JSON array of exactly 3 strings. Each string is one insight (1-2 sentences, specific and data-driven).
Example: ["Observation one.", "Observation two.", "Observation three."]`

    const content = await callGroq(prompt, 350)

    let insights = []
    try {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) insights = JSON.parse(match[0])
    } catch {
      insights = content.match(/"([^"]{10,}?)"/g)?.slice(0, 3).map(s => s.replace(/^"|"$/g, '')) || []
    }

    res.json({ insights: insights.slice(0, 3), generated_at: new Date().toISOString() })
  } catch (err) {
    if (err.code === 'NO_GROQ_KEY') return res.status(503).json({ error: 'AI not configured', code: 'NO_GROQ_KEY' })
    if (err.response?.status === 429) return res.status(429).json({ error: 'Rate limit, try again shortly', code: 'GROQ_RATE' })
    next(err)
  }
})

// POST /api/v1/analytics/ai-narrative
// Generates a UN-style SITREP narrative using the Groq LLM API.
router.post('/ai-narrative', auth, async (req, res, next) => {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return res.status(503).json({ error: 'AI narrative not configured', code: 'NO_GROQ_KEY' })
    }

    const lang = req.body.language || 'en'
    const sitrep = await getSituationReport()
    const a = sitrep.analytics

    // Build a compact data summary for the prompt
    const damageLines = Object.entries(a.by_damage_level || {})
      .map(([k, v]) => `  - ${k}: ${v} reports`).join('\n')
    const crisisLines = Object.entries(a.by_crisis_type || {})
      .sort((x, y) => y[1] - x[1]).slice(0, 5)
      .map(([k, v]) => `  - ${k.replace(/_/g,' ')}: ${v}`).join('\n')
    const areaLines = (sitrep.top_areas || []).slice(0, 5)
      .map(a => `  - ${a.location_text}: ${a.report_count} reports (${a.complete_count} severe)`).join('\n')
    const needsMap = {}
    ;(sitrep.priority_reports || []).forEach(r => {
      (r.pressing_needs || []).forEach(n => { needsMap[n] = (needsMap[n] || 0) + 1 })
    })
    const needsLines = Object.entries(needsMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([k,v]) => `  - ${k}: ${v} reports`).join('\n') || '  - No pressing needs data'

    const trendDir = sitrep.trends?.change_pct > 5 ? 'INCREASING' :
                     sitrep.trends?.change_pct < -5 ? 'DECREASING' : 'STABLE'

    const LANG_INSTRUCTION = {
      en: 'Write in English.',
      fr: 'Écrivez en français.',
      es: 'Escriba en español.',
      ar: 'اكتب باللغة العربية.',
      zh: '用中文写。',
      ru: 'Пишите на русском языке.'
    }

    const prompt = `You are a UNDP crisis response analyst. Generate a concise, professional Situation Report (SITREP) from the following field data. ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}

CRISIS DATA SUMMARY:
- Total reports: ${a.total_reports}
- Reports last 24h: ${a.reports_last_24h}
- Reports last 1h: ${a.reports_last_1h}
- Reporting trend (3h): ${trendDir} (${sitrep.trends?.change_pct ?? 0}%)
- Unique buildings affected: ${a.unique_buildings_affected}
- Estimated people affected: ~${(a.estimated_affected || 0).toLocaleString()}

DAMAGE BREAKDOWN:
${damageLines || '  - No data'}

CRISIS TYPES REPORTED:
${crisisLines || '  - No data'}

TOP AFFECTED AREAS:
${areaLines || '  - No location data'}

MOST PRESSING NEEDS:
${needsLines}

Generate a SITREP with EXACTLY these sections (use these exact headings):
1. EXECUTIVE SUMMARY (2-3 sentences, key situation overview)
2. SITUATION OVERVIEW (current conditions, scale, affected areas)
3. KEY FINDINGS (bullet points: damage assessment, crisis types, geographic spread)
4. IMMEDIATE NEEDS (prioritised list of humanitarian needs)
5. RECOMMENDED ACTIONS (3-5 specific, actionable recommendations for response teams)

Be factual, concise, and professional. Use UN humanitarian reporting standards. Do not invent data not present in the summary above.`

    const narrative = await callGroq(prompt, 1200)
    res.json({ narrative, generated_at: new Date().toISOString(), language: lang })
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(502).json({ error: 'Invalid Groq API key', code: 'GROQ_AUTH' })
    }
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'AI rate limit reached, try again in a moment', code: 'GROQ_RATE' })
    }
    next(err)
  }
})

module.exports = router
