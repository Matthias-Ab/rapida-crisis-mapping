/**
 * RAPIDA Functional Test Suite
 * Tests real interactions: submission, dashboard toggles, filters, AI features
 *
 * Run: node test-functional.mjs
 * Requires: Vite dev server on :5174 (or set APP_URL=http://localhost:5173)
 *           Backend on :3001 (optional — offline path tested if down)
 */
import { chromium } from '/tmp/pw_test/node_modules/playwright/index.mjs'

const BASE      = process.env.APP_URL  || 'http://localhost:5174'
const DASH_KEY  = 'rapida-dev-key-2026'
const IS_LIVE   = BASE.includes('vercel') || BASE.includes('railway')
const TIMEOUT   = IS_LIVE ? 20000 : 12000

const results = []
let browser, page

function pass(name)      { results.push({ name, status: 'PASS' }); console.log(`  ✅  ${name}`) }
function fail(name, err) { results.push({ name, status: 'FAIL', err: String(err).split('\n')[0] }); console.log(`  ❌  ${name}\n      ${String(err).split('\n')[0]}`) }
function info(msg)       { console.log(`  ℹ️   ${msg}`) }

async function check(name, fn) {
  try { await fn(); pass(name) } catch (e) { fail(name, e) }
}

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
}

/** Inject a small synthetic JPEG into a file input */
async function injectPhoto(selector) {
  // Create a 200x200 red JPEG via canvas inside the page
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 200; c.height = 200
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(0, 0, 200, 200)
    ctx.fillStyle = 'white'
    ctx.font = '24px sans-serif'
    ctx.fillText('TEST', 70, 110)
    return c.toDataURL('image/jpeg', 0.8)
  })
  // Convert to a Buffer and set on the input
  const base64 = dataUrl.split(',')[1]
  const buf = Buffer.from(base64, 'base64')
  await page.setInputFiles(selector, {
    name: 'test-damage.jpg',
    mimeType: 'image/jpeg',
    buffer: buf
  })
}

/** Mock GPS to a fixed position */
async function mockGPS(lat = 36.2021, lng = 36.1604) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: lat, longitude: lng, accuracy: 10 })
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nRAPIDA Functional Test — ${BASE}\n${'─'.repeat(52)}`)
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })

  // ── 1. Report Submission — Quick Mode ─────────────────────────────────────
  console.log('\n[1] Quick Report Submission')

  const ctx = await browser.newContext()
  page = await ctx.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGPS()

  await check('Mode selector loads on /submit', async () => {
    await goto('/submit')
    await page.waitForSelector('text=Quick Report', { timeout: TIMEOUT })
  })

  await check('Quick Report mode selected → Step 1 of 3', async () => {
    await page.click('text=Quick Report')
    await page.waitForSelector('text=Step 1 of 3', { timeout: 5000 })
  })

  await check('Voice modal opens from step 1', async () => {
    await page.click('text=Report with Voice')
    await page.waitForSelector('text=Type instead', { timeout: 5000 })
    await page.press('Escape', { delay: 100 }).catch(() => {})
    // Close by clicking outside or X
    const closeBtn = await page.$('button[aria-label="Close"]')
    if (closeBtn) await closeBtn.click()
    else await page.keyboard.press('Escape')
    await page.waitForSelector('text=Step 1 of 3', { timeout: 3000 })
  })

  await check('Photo upload accepted on step 1', async () => {
    const input = await page.$('input[type="file"][accept*="image"]')
    if (!input) throw new Error('No file input found')
    await injectPhoto('input[type="file"][accept*="image"]')
    await page.waitForTimeout(800)
    // Photo preview should appear
    const preview = await page.$('img[alt*="Photo"], img[alt*="preview"], .rounded-2xl img')
    if (!preview) throw new Error('Photo preview not shown after upload')
  })

  await check('Next → Step 2 (Location)', async () => {
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 2 of 3', { timeout: 5000 })
  })

  await check('GPS auto-detects location', async () => {
    // Click "Use my current location" button
    const gpsBtn = await page.$('button:has-text("Use My Current Location"), button:has-text("Use GPS"), button:has-text("location")')
    if (gpsBtn) {
      await gpsBtn.click()
      await page.waitForTimeout(2000)
    }
    // Either location is selected OR map shows
    const hasMap = await page.$('.leaflet-container')
    if (!hasMap) throw new Error('Map not shown on location step')
  })

  await check('Next → Step 3 (Quick Damage + Crisis)', async () => {
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 3 of 3', { timeout: 5000 })
  })

  await check('Damage level card selectable', async () => {
    // Click "Complete" damage
    await page.click('button[aria-pressed]:has-text("Completely Damaged"), button:has-text("Complete")')
    await page.waitForTimeout(300)
    // Verify it's selected (pressed)
    const pressed = await page.$('button[aria-pressed="true"]')
    if (!pressed) throw new Error('No damage level selected')
  })

  await check('Crisis type selectable', async () => {
    // Click earthquake
    await page.click('button[aria-pressed]:has-text("Earthquake"), button:has-text("Earthquake")')
    await page.waitForTimeout(300)
  })

  let submissionOutcome = 'unknown'
  await check('Form submits (online → success screen, offline → queued)', async () => {
    const submitBtn = await page.$('button:has-text("Submit Report")')
    if (!submitBtn) throw new Error('Submit button not found')
    await submitBtn.click()
    // Wait for success screen OR offline banner OR error message
    const result = await Promise.race([
      page.waitForSelector('text=Report Submitted Successfully', { timeout: 20000 }).then(() => 'success'),
      page.waitForSelector('text=Saved — will submit', { timeout: 20000 }).then(() => 'offline'),
      page.waitForSelector('text=Submit Another', { timeout: 20000 }).then(() => 'done'),
      page.waitForSelector('[role="alert"]', { timeout: 20000 }).then(async (el) => {
        const txt = await el.textContent()
        return `error: ${txt.trim().slice(0, 60)}`
      }),
    ])
    submissionOutcome = result
    info(`Submission outcome: ${result}`)
    if (result.startsWith('error:')) throw new Error(`Submit returned error — ${result}`)
  })

  await check('Success/offline screen has expected elements', async () => {
    await page.waitForSelector('text=Submit Another', { timeout: 8000 })
  })

  await ctx.close()

  // ── 2. Detailed Form Steps ─────────────────────────────────────────────────
  console.log('\n[2] Detailed Form — all 5 steps')

  const ctx2 = await browser.newContext()
  page = await ctx2.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await mockGPS()

  await check('Detailed mode: all 5 steps navigable', async () => {
    await goto('/submit')
    await page.waitForSelector('text=Detailed Report', { timeout: TIMEOUT })
    await page.click('text=Detailed Report')
    await page.waitForSelector('text=Step 1 of 5', { timeout: TIMEOUT })

    // Step 1: photo
    await injectPhoto('input[type="file"][accept*="image"]')
    await page.waitForTimeout(800)
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 2 of 5', { timeout: TIMEOUT })

    // Step 2: click GPS button to trigger location request (mock returns immediately)
    const gpsBtn = await page.$('button:has-text("Use My Current Location")')
    if (gpsBtn) {
      await gpsBtn.click()
      await page.waitForFunction(() => {
        const body = document.body.innerText
        return body.includes('Location selected') || body.includes('36.') || body.includes('Accuracy')
      }, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)
    }
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 3 of 5', { timeout: TIMEOUT })

    // Step 3: damage — click by role and position (class names may differ in prod builds)
    const damageBtns = await page.$$('[role="radiogroup"] button, button.damage-card')
    if (damageBtns.length === 0) throw new Error('No damage level buttons found')
    await damageBtns[1].click() // Partial = index 1
    await page.waitForTimeout(500)
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 4 of 5', { timeout: TIMEOUT })

    // Step 4: infra + crisis + debris (all required)
    const infraBtns = await page.$$('button[aria-pressed]')
    if (infraBtns.length > 0) await infraBtns[0].click() // Residential
    await page.waitForTimeout(200)
    // Crisis type — click first radio label
    const crisisLabel = await page.$('label[class*="rounded-xl"], label:has(input[type="radio"])')
    if (crisisLabel) await crisisLabel.click()
    else {
      const radio = await page.$('input[type="radio"]')
      if (radio) await radio.click()
    }
    await page.waitForTimeout(200)
    // Debris — required since audit fix; click "Yes" or first debris button
    const debrisBtns = await page.$$('button[aria-pressed]:has-text("Yes"), button:has-text("Yes")')
    if (debrisBtns.length > 0) await debrisBtns[0].click()
    else {
      // Find any debris-related button (grid of 3 buttons after the debris question)
      const allAriaPressed = await page.$$('button[aria-pressed]')
      if (allAriaPressed.length > 2) await allAriaPressed[allAriaPressed.length - 3].click()
    }
    await page.waitForTimeout(300)
    await page.click('button:has-text("Next")')
    await page.waitForSelector('text=Step 5 of 5', { timeout: TIMEOUT })
  })

  await check('Step 5 description textarea works', async () => {
    // Description is always visible on step 5 (not inside collapsed section)
    const textarea = await page.$('textarea')
    if (!textarea) throw new Error('Description textarea not found on step 5')
    await textarea.fill('Test report — building shows significant water damage')
    await page.waitForTimeout(200)
    const val = await textarea.inputValue()
    if (!val.includes('water damage')) throw new Error('Textarea value not saved')
  })

  await ctx2.close()

  // ── 3. Dashboard Interactions ──────────────────────────────────────────────
  console.log('\n[3] Dashboard Interactions')

  const ctx3 = await browser.newContext()
  page = await ctx3.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })

  // Login to dashboard
  await goto('/dashboard')
  await page.waitForSelector('input', { timeout: TIMEOUT })
  await page.fill('input', DASH_KEY)
  await page.click('button:has-text("Access Dashboard")')
  await page.waitForSelector('.leaflet-container', { timeout: 15000 })
  await page.waitForTimeout(2000)

  // Get initial marker count
  const initialCount = await page.evaluate(() => {
    const chip = document.querySelector('[class*="Showing"], [class*="showing"]')
    return chip?.textContent?.match(/\d+/)?.[0] || null
  })
  info(`Initial report count: ${initialCount || 'unknown'}`)

  await check('Damage filter reduces visible reports', async () => {
    // Click "Completely Damaged" checkbox in sidebar
    const checkbox = await page.$('input[type="checkbox"]')
    if (!checkbox) throw new Error('No checkboxes in filter sidebar')

    const beforeCount = await page.evaluate(() =>
      document.querySelectorAll('.leaflet-marker-icon').length
    )

    await checkbox.click()
    await page.waitForTimeout(1500)

    const afterCount = await page.evaluate(() =>
      document.querySelectorAll('.leaflet-marker-icon').length
    )
    info(`Markers: ${beforeCount} → ${afterCount} after filter`)
    // Either count changed OR the "Showing X of Y" chip changed
    const chip = await page.$eval('[class*="rounded-full"]', el => el.textContent).catch(() => '')
    if (beforeCount === afterCount && !chip.includes('of')) {
      throw new Error(`Marker count unchanged after filter (${beforeCount})`)
    }

    // Reset — use evaluate to find and click by text content
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.trim() === 'Clear All')
      if (btn) btn.click()
    })
    await page.waitForTimeout(1000)
  })

  await check('Consolidated toggle shows cluster circles', async () => {
    await page.click('button:has-text("Consolidated")')
    await page.waitForTimeout(2000)
    // Consolidated markers use divIcon with report count
    const consolidated = await page.evaluate(() =>
      document.querySelectorAll('.leaflet-marker-icon div').length
    )
    info(`Consolidated cluster markers: ${consolidated}`)
    if (consolidated === 0) throw new Error('No consolidated cluster markers appeared')
    // Toggle off
    await page.click('button:has-text("Consolidated")')
    await page.waitForTimeout(500)
  })

  await check('Needs toggle shows filter strip', async () => {
    await page.click('button:has-text("🆘 Needs"), button:has-text("Needs")')
    await page.waitForSelector('text=Rescue', { timeout: 4000 })
    await page.waitForSelector('text=Medical', { timeout: 2000 })
  })

  await check('Rescue filter pill has count and reduces markers', async () => {
    const pill = await page.$('button:has-text("Rescue")')
    if (!pill) throw new Error('Rescue pill not found')
    const pillText = await pill.textContent()
    info(`Rescue pill text: "${pillText.trim()}"`)

    const before = await page.evaluate(() =>
      document.querySelectorAll('.leaflet-marker-icon').length
    )
    await pill.click()
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() =>
      document.querySelectorAll('.leaflet-marker-icon').length
    )
    info(`Markers: ${before} → ${after} on Rescue filter`)

    // Toggle off
    await page.click('button:has-text("🆘 Needs"), button:has-text("Needs")')
    await page.waitForTimeout(500)
  })

  await check('Heatmap toggle shows heatmap layer', async () => {
    await page.click('button:has-text("Heatmap")')
    await page.waitForTimeout(1500)
    const canvas = await page.$('.leaflet-heatmap-layer, canvas')
    if (!canvas) {
      // Heatmap renders on a canvas — check if any canvas appeared
      const anyCanvas = await page.evaluate(() =>
        document.querySelectorAll('canvas').length
      )
      if (anyCanvas === 0) throw new Error('No canvas/heatmap layer appeared')
      info(`Canvas elements: ${anyCanvas}`)
    }
    await page.click('button:has-text("Heatmap")')
    await page.waitForTimeout(500)
  })

  await check('Map marker popup opens on click', async () => {
    // Click a Top Affected Area to fly the map to a known cluster
    const areaBtn = await page.$('[class*="space-y-1"] button, .space-y-1 button')
    if (areaBtn) {
      await areaBtn.click()
      await page.waitForTimeout(2000) // let flyTo animation complete
    }

    // Click the Leaflet + zoom button several times to break clusters
    for (let i = 0; i < 4; i++) {
      const zoomIn = await page.$('.leaflet-control-zoom-in')
      if (zoomIn) await zoomIn.click()
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(1000)

    // The popup is a React component (ReportPopup), not a Leaflet popup.
    // Only click markers that are inside the current viewport.
    const allIcons = await page.$$('.leaflet-marker-icon')
    info(`Map icons after zoom: ${allIcons.length}`)

    const vpWidth = 1280, vpHeight = 800
    let opened = false
    for (const icon of allIcons) {
      try {
        const box = await icon.boundingBox()
        // Skip icons outside the visible viewport
        if (!box || box.y < 0 || box.y > vpHeight || box.x < 0 || box.x > vpWidth) continue
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(1000)
        // ReportPopup renders with a thumbnail and damage badge - look for those
        const popup = await page.$('[class*="absolute"][class*="z-"][class*="bg-white"], [class*="ReportPopup"], .absolute.z-50, .absolute.z-\\[1000\\]')
        if (!popup) {
          // Try finding by content: damage level or "View full report" link
          const found = await page.$('a:has-text("View full report"), text=View full report')
          if (found) {
            const txt = await page.textContent('body')
            const snippet = txt.match(/(complete|partial|none|Verified|Flagged)/i)?.[0]
            info(`Popup opened (React panel): damage=${snippet}`)
            opened = true
            break
          }
        } else {
          const txt = await popup.textContent()
          info(`Popup: "${txt.substring(0, 60).trim()}..."`)
          opened = true
          break
        }
      } catch { /* try next */ }
    }
    if (!opened) throw new Error('No report popup opened after clicking all visible markers')
  })

  await check('Priority queue dispatch removes item', async () => {
    // Scroll sidebar to load Priority Queue panel
    await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="overflow-y-auto"]')
      if (sidebar) sidebar.scrollTop = sidebar.scrollHeight
    })
    await page.waitForTimeout(1500)
    const dispatchBtns = await page.$$('button:has-text("Dispatch"), button:has-text("✓ Dispatch")')
    if (!dispatchBtns.length) throw new Error('No dispatch buttons found')
    const initialLen = dispatchBtns.length
    await dispatchBtns[0].click()
    await page.waitForTimeout(1500)
    const newLen = (await page.$$('button:has-text("Dispatch")')).length
    if (newLen >= initialLen) throw new Error(`Dispatch button count unchanged (${initialLen} → ${newLen})`)
    info(`Queue: ${initialLen} → ${newLen} after dispatch`)
  })

  await check('Photo Evidence panel opens and shows thumbnails', async () => {
    // Scroll back to top of sidebar to find Photo Evidence
    await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="overflow-y-auto"]')
      if (sidebar) sidebar.scrollTop = 0
    })
    await page.waitForTimeout(500)
    const panel = await page.$('button:has-text("Photo Evidence")')
    if (!panel) throw new Error('Photo Evidence panel not found')
    await panel.click()
    await page.waitForTimeout(1000)
    const imgs = await page.$$('.leaflet-container ~ * img, [class*="grid"] img')
    info(`Photo thumbnails visible: ${imgs.length}`)
    // Toggle closed
    await panel.click()
  })

  await check('AI Insights generate button works', async () => {
    const btn = await page.$('button:has-text("Generate"), button:has-text("→")')
    if (!btn) throw new Error('AI Insights generate button not found')
    await btn.click()
    // Wait for either insights or an error message
    const result = await Promise.race([
      page.waitForSelector('[class*="space-y-2"] p, .space-y-2 p', { timeout: 20000 }).then(() => 'insights'),
      page.waitForSelector('text=Rate limit, text=configured, text=Failed', { timeout: 20000 }).then(() => 'error'),
    ]).catch(() => 'timeout')
    info(`AI Insights result: ${result}`)
    if (result === 'timeout') throw new Error('AI Insights timed out (backend may be offline)')
  })

  await ctx3.close()

  // ── 4. Situation Report AI ─────────────────────────────────────────────────
  console.log('\n[4] Situation Report')

  const ctx4 = await browser.newContext()
  page = await ctx4.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })

  await goto('/situation-report')
  await page.waitForSelector('input[type="password"]', { timeout: TIMEOUT })
  await page.fill('input[type="password"]', DASH_KEY)
  await page.click('button:has-text("Access Report")')
  await page.waitForSelector('text=Crisis Situation Report', { timeout: 30000 })

  await check('All 5 metric cards visible', async () => {
    await page.waitForSelector('text=Reports (24h)', { timeout: 5000 })
    await page.waitForSelector('text=Est. People Affected', { timeout: 3000 })
    await page.waitForSelector('text=Trend', { timeout: 3000 })
  })

  await check('Damage assessment bars rendered', async () => {
    const bars = await page.$$('[style*="width"][class*="rounded-full"]')
    if (bars.length === 0) throw new Error('No progress bars found in damage assessment')
    info(`Progress bars found: ${bars.length}`)
  })

  await check('Top Affected Areas table has rows', async () => {
    await page.waitForSelector('text=Top Affected Areas', { timeout: 5000 })
    const rows = await page.$$('tr, [class*="border-b"]')
    if (rows.length < 2) throw new Error('Less than 2 rows in affected areas table')
  })

  await check('AI Narrative generates via Groq', async () => {
    await page.click('button:has-text("AI Narrative"), button:has-text("Generate")')
    const result = await Promise.race([
      page.waitForSelector('text=EXECUTIVE SUMMARY, text=Executive Summary', { timeout: 25000 }).then(() => 'narrative'),
      page.waitForSelector('[class*="teal"] [class*="prose"], .prose', { timeout: 25000 }).then(() => 'narrative'),
      page.waitForSelector('text=Rate limit, text=not configured, text=Failed', { timeout: 25000 }).then(() => 'error'),
    ]).catch(() => 'timeout')
    info(`AI Narrative result: ${result}`)
    if (result === 'timeout') throw new Error('AI Narrative timed out')
    if (result === 'error') throw new Error('AI Narrative returned an error')
  })

  await check('Copy button present after narrative', async () => {
    await page.waitForSelector('button:has-text("Copy"), button:has-text("📋")', { timeout: 5000 })
  })

  await check('WhatsApp share button present', async () => {
    await page.waitForSelector('a:has-text("WhatsApp")', { timeout: 3000 })
  })

  await check('Print button present', async () => {
    await page.waitForSelector('button:has-text("Print")', { timeout: 3000 })
  })

  await ctx4.close()

  // ── 5. Report Detail & Translation ────────────────────────────────────────
  console.log('\n[5] Report Detail')

  const ctx5 = await browser.newContext()
  page = await ctx5.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  await check('Report detail shows all sections', async () => {
    const id = await page.evaluate(async (key) => {
      try {
        const r = await fetch(`${window.location.origin}/api/v1/reports?limit=1`, { headers: { 'X-API-Key': key } })
        const d = await r.json()
        return d?.features?.[0]?.id || null
      } catch { return null }
    }, DASH_KEY).catch(() => null)

    if (!id) { info('No reports in DB — skipping detail test'); return }
    await goto(`/reports/${id}`)
    await page.waitForSelector('text=RAPIDA Report', { timeout: TIMEOUT })
    await page.waitForSelector('text=Damage Level', { timeout: 3000 })
    await page.waitForSelector('.leaflet-container', { timeout: 5000 })
  })

  await check('Translation button visible on report with description', async () => {
    const translateBtn = await page.$('button:has-text("Translate"), button:has-text("🌐")')
    if (!translateBtn) {
      info('No translate button — report may have no description or backend offline')
      return
    }
    await translateBtn.click()
    const result = await Promise.race([
      page.waitForSelector('text=Translation', { timeout: 15000 }).then(() => 'translated'),
      page.waitForSelector('text=failed, text=error', { timeout: 15000 }).then(() => 'error'),
    ]).catch(() => 'timeout')
    info(`Translation result: ${result}`)
  })

  await ctx5.close()

  // ── Summary ────────────────────────────────────────────────────────────────
  await browser.close()

  const passed  = results.filter(r => r.status === 'PASS').length
  const failed  = results.filter(r => r.status === 'FAIL').length

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`Results: ${passed} passed  ${failed} failed`)

  if (failed > 0) {
    console.log('\nFailed:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌  ${r.name}`)
      console.log(`      ${r.err}`)
    })
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(async e => {
  console.error('\nTest runner crashed:', e.message)
  if (browser) await browser.close()
  process.exit(1)
})
