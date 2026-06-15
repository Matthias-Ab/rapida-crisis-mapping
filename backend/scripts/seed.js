require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { prisma } = require('../src/db/connection')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

const BASE = 'http://localhost:9000/crisis-reports'
const LOCATIONS = [
  { name: 'Antakya, Turkey',       lat: 36.2021, lng:  36.1604, crisis: 'earthquake' },
  { name: 'Derna, Libya',          lat: 32.7541, lng:  22.6374, crisis: 'flood' },
  { name: 'Kharkiv, Ukraine',      lat: 49.9935, lng:  36.2304, crisis: 'conflict' },
  { name: 'Addis Ababa, Ethiopia', lat:  9.0249, lng:  38.7469, crisis: 'flood' },
  { name: 'Marrakech, Morocco',    lat: 31.6295, lng:  -8.0088, crisis: 'earthquake' },
  { name: 'Lahore, Pakistan',      lat: 31.5497, lng:  74.3436, crisis: 'flood' },
  { name: 'Port-au-Prince, Haiti', lat: 18.5944, lng: -72.3074, crisis: 'earthquake' },
]
const DAMAGE   = ['none','partial','complete']
const INFRA    = ['residential','commercial','government','utility','transport_communication','community','public_recreation','other']
const ELECTRIC = ['operational','partial','non_functional','unknown']
const HEALTH   = ['operational','limited','closed','unknown']
const NEEDS    = ['water','food','shelter','medical','rescue','electricity','communications','sanitation']
const DESCS = {
  earthquake: [
    'Structural collapse on northeast corner. Load-bearing walls cracked throughout.',
    'Roof has partially collapsed. Ground floor inhabitable with caution.',
    'Foundation cracked visibly. Building is leaning to the east side.',
    'All windows shattered, interior walls damaged beyond repair.',
    'Main entrance blocked by fallen masonry. Structural integrity severely compromised.',
    'Upper two floors destroyed. Lower floors accessible but unsafe.',
    'Stairwell destroyed. Emergency exit routes blocked by debris.',
    'Exterior facade damaged but internal structure appears intact.',
  ],
  flood: [
    'Ground floor completely submerged. Water line visible at 1.5m on exterior wall.',
    'Basement flooded, electrical systems destroyed. Mould already forming.',
    'Exterior walls show significant water damage. Foundation undermined.',
    'Road adjacent is impassable. Vehicles swept 200m downstream.',
    'First floor evacuated. Bridge approach washed away.',
    'Sewage overflow contaminating the area. Health risk to residents.',
    'Flood waters receding but structural damage to foundations suspected.',
    'Community water pump submerged and non-functional.',
  ],
  conflict: [
    'Facade damaged by shrapnel impact. All windows blown out.',
    'Upper two floors destroyed by blast damage. Lower floor partially intact.',
    'Roof collapsed from direct impact. Structure completely unsafe.',
    'Perimeter wall destroyed. Courtyard debris up to 1m deep.',
    'Secondary fires caused significant burn damage to south wing.',
    'Building shell intact but interior completely gutted.',
    'Adjacent road cratered. Access to facility blocked.',
    'Communications tower on roof destroyed. No signal in 500m radius.',
  ],
}
function jitter() { return (Math.random() - 0.5) * 0.008 }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickN(arr, max) { return [...arr].sort(() => Math.random()-0.5).slice(0, 1+Math.floor(Math.random()*max)) }
function hashIp(s) { return crypto.createHash('sha256').update(s).digest('hex') }

const sessions = Array.from({ length: 20 }, () => uuidv4())
const now = Date.now()
const reports = Array.from({ length: 80 }, (_, i) => {
  const loc = LOCATIONS[i % LOCATIONS.length]
  const id  = uuidv4()
  const descs = DESCS[loc.crisis] || DESCS.earthquake
  return {
    id, lat: loc.lat + jitter(), lng: loc.lng + jitter(),
    createdAt: new Date(now - (Math.random() * 72) * 3600000),
    locationText: loc.name,
    photoUrl: `${BASE}/photos/seed-${id}.jpg`,
    photoKey: `photos/seed-${id}.jpg`,
    thumbUrl: `${BASE}/thumbnails/seed-${id}.jpg`,
    damageLevel:       pick(DAMAGE),
    infraType:         pick(INFRA),
    crisisType:        loc.crisis,
    description:       pick(descs),
    debrisPresent:     Math.random() > 0.4,
    electricityStatus: pick(ELECTRIC),
    healthStatus:      pick(HEALTH),
    pressingNeeds:     pickN(NEEDS, 3),
    sessionId:         pick(sessions),
    ipHash:            hashIp(`10.${i%255}.0.1`),
    isVerified:        Math.random() > 0.85,
    isFlagged:         Math.random() > 0.95,
  }
})

async function seed() {
  console.log(`Seeding ${reports.length} reports across 7 crisis zones…`)
  let ok = 0, fail = 0
  for (const r of reports) {
    try {
      await prisma.$executeRaw`
        INSERT INTO reports (
          id, created_at, updated_at,
          latitude, longitude, coordinates,
          location_text,
          photo_url, photo_key, thumbnail_url,
          damage_level, infra_type, crisis_type,
          description, debris_present,
          electricity_status, health_services_status, pressing_needs,
          session_id, ip_hash, language, is_verified, is_flagged
        ) VALUES (
          ${r.id}::uuid,
          ${r.createdAt}::timestamptz, ${r.createdAt}::timestamptz,
          ${r.lat}::float8, ${r.lng}::float8,
          ST_SetSRID(ST_MakePoint(${r.lng}::float8, ${r.lat}::float8), 4326),
          ${r.locationText},
          ${r.photoUrl}, ${r.photoKey}, ${r.thumbUrl},
          ${r.damageLevel}, ${r.infraType}, ${r.crisisType},
          ${r.description}, ${r.debrisPresent},
          ${r.electricityStatus}, ${r.healthStatus}, ${r.pressingNeeds},
          ${r.sessionId}, ${r.ipHash}, 'en', ${r.isVerified}, ${r.isFlagged}
        ) ON CONFLICT (id) DO NOTHING`
      ok++
    } catch (e) {
      console.error(`  ✗ ${r.id.slice(0,8)}: ${e.message.split('\n')[0]}`)
      fail++
    }
  }
  console.log(`✓ Inserted ${ok}  ✗ Failed ${fail}`)
  const [{ n }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM reports`
  console.log(`Total in DB: ${n}`)
  // Only disconnect if running as a standalone script, not when called from app.js
  if (require.main === module) await prisma.$disconnect()
  return ok
}

// Auto-seed: called from app.js if the DB is empty on startup
async function autoSeedIfEmpty(prismaClient) {
  const count = await prismaClient.report.count()
  if (count > 10) return  // Already has data
  console.log(`Empty DB (${count} reports) — running demo seed…`)
  await seed()
}

if (require.main === module) {
  seed().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
}

module.exports = { autoSeedIfEmpty }
