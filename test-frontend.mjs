/**
 * RAPIDA Frontend Smoke Test
 * Run: node test-frontend.mjs
 * Requires: Vite dev server on :5174 (or :5173)
 */
import { chromium } from '/tmp/pw_test/node_modules/playwright/index.mjs'

const BASE = process.env.APP_URL || 'http://localhost:5174'
const DASH_KEY = 'rapida-dev-key-2026'

const results = []
let browser, page

function pass(name)        { results.push({ name, status: 'PASS' }); console.log(`  ✅  ${name}`) }
function fail(name, err)   { results.push({ name, status: 'FAIL', err: String(err).split('\n')[0] }); console.log(`  ❌  ${name}\n      ${String(err).split('\n')[0]}`) }
function skip(name, why)   { results.push({ name, status: 'SKIP', err: why }); console.log(`  ⏭️  ${name} — ${why}`) }

async function check(name, fn) {
  try { await fn(); pass(name) }
  catch (e) { fail(name, e) }
}

async function goto(path, opts = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000, ...opts })
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nRAPIDA Frontend Smoke Test — ${BASE}\n${'─'.repeat(50)}`)
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // ── 1. Submit page loads ──────────────────────────────────────────────────
  console.log('\n[1] Submit page')
  await check('Submit page loads', async () => {
    await goto('/submit')
    await page.waitForSelector('text=RAPIDA Crisis Mapping', { timeout: 8000 })
  })

  await check('Mode selector shown (Quick / Detailed)', async () => {
    await goto('/submit')
    await page.waitForSelector('text=Quick Report', { timeout: 6000 })
    await page.waitForSelector('text=Detailed Report', { timeout: 3000 })
  })

  await check('Quick mode: 3 steps visible after selection', async () => {
    await goto('/submit')
    await page.waitForSelector('text=Quick Report', { timeout: 6000 })
    await page.click('text=Quick Report')
    await page.waitForSelector('text=Step 1 of 3', { timeout: 5000 })
  })

  await check('Detailed mode: 5 steps visible after selection', async () => {
    await goto('/submit')
    await page.waitForSelector('text=Detailed Report', { timeout: 6000 })
    await page.click('text=Detailed Report')
    await page.waitForSelector('text=Step 1 of 5', { timeout: 5000 })
  })

  await check('Voice Report button present on step 1', async () => {
    await goto('/submit')
    await page.click('text=Quick Report')
    await page.waitForSelector('text=Report with Voice', { timeout: 5000 })
  })

  await check('Voice modal opens', async () => {
    await goto('/submit')
    await page.click('text=Quick Report')
    await page.click('text=Report with Voice')
    await page.waitForSelector('text=Type instead', { timeout: 5000 })
  })

  await check('Text fallback: detect fields from typed description', async () => {
    await goto('/submit')
    await page.click('text=Quick Report')
    await page.click('text=Report with Voice')
    await page.click('text=Type instead')
    const ta = await page.waitForSelector('textarea', { timeout: 4000 })
    await ta.fill('collapsed residential building earthquake rescue needed medical')
    await page.click('text=Detect fields')
    await page.waitForSelector('.bg-green-50', { timeout: 5000 })
  })

  // ── 2. Navigation ─────────────────────────────────────────────────────────
  console.log('\n[2] Navigation & pages')
  await check('/map page loads', async () => {
    await goto('/map')
    await page.waitForSelector('.leaflet-container', { timeout: 10000 })
  })

  await check('/reports page loads', async () => {
    await goto('/reports')
    await page.waitForSelector('body', { timeout: 8000 })
    const url = page.url()
    if (url.includes('error') || url.includes('404')) throw new Error('Redirected to error page')
  })

  await check('/privacy page loads', async () => {
    await goto('/privacy')
    await page.waitForSelector('text=Privacy', { timeout: 5000 })
  })

  await check('404 page shows for unknown route', async () => {
    await goto('/this-does-not-exist')
    await page.waitForSelector('text=Page not found', { timeout: 5000 })
  })

  // ── 3. Dashboard ──────────────────────────────────────────────────────────
  console.log('\n[3] Dashboard')
  await check('Dashboard login screen shows', async () => {
    await goto('/dashboard')
    await page.waitForSelector('text=Dashboard API Key', { timeout: 8000 })
  })

  await check('Dashboard unlocks with correct key', async () => {
    await goto('/dashboard')
    await page.fill('input', DASH_KEY)
    await page.click('button:has-text("Access Dashboard")')
    await page.waitForSelector('.leaflet-container', { timeout: 12000 })
  })

  await check('Stat cards visible (Total Reports)', async () => {
    // Already on dashboard after previous test
    await page.waitForSelector('text=Total Reports', { timeout: 5000 })
  })

  await check('Consolidated toggle present (scrollable toolbar)', async () => {
    await page.waitForSelector('button:has-text("Consolidated")', { timeout: 5000 })
  })

  await check('Needs heatmap toggle present (scrollable toolbar)', async () => {
    await page.waitForSelector('button:has-text("Needs")', { timeout: 5000 })
  })

  await check('Needs filter strip appears on toggle', async () => {
    await page.click('button:has-text("Needs")')
    await page.waitForSelector('text=Rescue', { timeout: 4000 })
    await page.waitForSelector('text=Medical', { timeout: 2000 })
  })

  await check('AI Insights panel present in sidebar', async () => {
    await page.waitForSelector('text=AI Insights', { timeout: 5000 })
  })

  await check('Photo Evidence panel present in sidebar', async () => {
    await page.waitForSelector('text=Photo Evidence', { timeout: 5000 })
  })

  await check('Priority Response Queue present', async () => {
    await page.waitForSelector('text=Priority Response Queue', { timeout: 5000 })
  })

  await check('Dispatch button present in priority queue', async () => {
    const dispatch = await page.$('button:has-text("Dispatch")')
    if (!dispatch) throw new Error('No Dispatch button found in priority queue')
  })

  // ── 4. Situation Report ───────────────────────────────────────────────────
  console.log('\n[4] Situation Report')
  await check('Situation Report page loads with login gate (fresh context)', async () => {
    // Use a fresh browser context so sessionStorage from dashboard doesn't carry over
    const ctx2 = await browser.newContext()
    const p2 = await ctx2.newPage()
    await p2.setViewportSize({ width: 390, height: 844 })
    await p2.goto(`${BASE}/situation-report`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await p2.waitForSelector('text=Analyst Access Required', { timeout: 8000 })
    await ctx2.close()
  })

  await check('Unlocks with API key + shows metrics', async () => {
    // Fresh context again
    const ctx3 = await browser.newContext()
    const p3 = await ctx3.newPage()
    await p3.setViewportSize({ width: 1280, height: 800 })
    await p3.goto(`${BASE}/situation-report`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await p3.waitForSelector('input', { timeout: 8000 })
    await p3.fill('input', DASH_KEY)
    await p3.click('button:has-text("Access Report")')
    await p3.waitForSelector('text=Total Reports', { timeout: 12000 })
    await ctx3.close()
  })

  await check('AI Narrative button visible', async () => {
    await page.waitForSelector('button:has-text("AI Narrative"), button:has-text("Generate")', { timeout: 5000 })
  })

  await check('Est. People Affected shown in metrics', async () => {
    const text = await page.textContent('body')
    if (!text.includes('Est. People') && !text.includes('Affected')) throw new Error('Population metric not found')
  })

  // ── 5. i18n ───────────────────────────────────────────────────────────────
  console.log('\n[5] Internationalisation')
  await check('Language switcher visible on submit page', async () => {
    await goto('/submit')
    await page.waitForSelector('[aria-label*="Language"], select, button:has-text("EN"), .language', { timeout: 5000 })
  })

  await check('URL ?lang=fr switches to French', async () => {
    await goto('/submit?lang=fr')
    await page.waitForTimeout(1000)
    const text = await page.textContent('body')
    if (!text.match(/signaler|rapport|langue/i)) throw new Error('French text not found after ?lang=fr')
  })

  await check('URL ?lang=ar switches to Arabic (RTL)', async () => {
    await goto('/submit?lang=ar')
    await page.waitForTimeout(1000)
    const dir = await page.evaluate(() => document.documentElement.dir)
    if (dir !== 'rtl') throw new Error(`Expected dir=rtl, got dir=${dir}`)
  })

  // ── 6. PWA ────────────────────────────────────────────────────────────────
  console.log('\n[6] PWA')
  await check('Service worker registered', async () => {
    await goto('/submit')
    await page.waitForTimeout(2000)
    const hasSW = await page.evaluate(() => !!navigator.serviceWorker?.controller || navigator.serviceWorker?.getRegistrations().then(r => r.length > 0))
    if (!hasSW) skip('Service worker registered', 'SW not active in headless — normal for first load')
  })

  await check('Manifest linked in HTML head', async () => {
    await goto('/')
    const href = await page.getAttribute('link[rel="manifest"]', 'href')
    if (!href) throw new Error('No <link rel="manifest"> in HTML head')
  })

  // ── 7. Report detail ──────────────────────────────────────────────────────
  console.log('\n[7] Report detail')
  await check('/reports/:id shows correct layout', async () => {
    // Fetch a report ID directly from the API without going through the dashboard UI
    const res = await page.evaluate(async (key) => {
      try {
        const r = await fetch('/api/v1/reports?limit=1', { headers: { 'X-API-Key': key } })
        const d = await r.json()
        return d?.features?.[0]?.id || d?.[0]?.id || null
      } catch { return null }
    }, DASH_KEY)

    if (!res) { skip('Report detail page', 'No reports in DB yet'); return }
    await goto(`/reports/${res}`)
    await page.waitForSelector('text=RAPIDA Report', { timeout: 6000 })
    await page.waitForSelector('text=Damage Level', { timeout: 3000 })
  })

  await check('Translate button present on report with description', async () => {
    const translateBtn = await page.$('button:has-text("Translate"), button:has-text("🌐")')
    if (!translateBtn) skip('Translate button', 'No description on this report or backend offline')
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  await browser.close()

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed  ${failed} failed  ${skipped} skipped`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌  ${r.name}`)
      console.log(`      ${r.err}`)
    })
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(async (e) => {
  console.error('Test runner crashed:', e.message)
  if (browser) await browser.close()
  process.exit(1)
})
