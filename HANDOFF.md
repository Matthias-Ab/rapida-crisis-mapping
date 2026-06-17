# RAPIDA — Project Handoff Document
**For Claude Code on a new machine**

---

## What This Is

RAPIDA is a full-stack crisis damage reporting PWA built for the **UNDP / InnoCentive "Build the Future of Crisis Mapping" competition** — $50,000 USD prize. Submission deadline: **June 23, 2026**. Today is June 15, 2026 — 8 days left.

UNDP evaluators test the **live deployed version**. The code is complete and pushed to GitHub. The only thing left is deployment.

---

## GitHub Repo

```
https://github.com/Matthias-Ab/rapida-crisis-mapping
```

Clone it:
```bash
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
```

---

## Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, Leaflet, Dexie.js (offline), Zustand, i18next (6 UN languages), @xenova/transformers (client-side AI)
- **Backend**: Node.js + Express, Prisma ORM, PostgreSQL 15 + PostGIS
- **Storage**: MinIO (S3-compatible — works with Cloudflare R2 or any S3 provider)
- **AI**: Groq API (Llama 3.3 70B) for SITREP, insights, translation
- **Infra**: Docker Compose, Nginx

---

## Credentials / Keys

```
GROQ_API_KEY=YOUR_GROQ_API_KEY  ← check your .env file or console.groq.com
DASHBOARD_API_KEY=rapida-dev-key-2026
POSTGRES_USER=crisis_user
POSTGRES_PASSWORD=changeme
POSTGRES_DB=crisis_mapper
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

## What's Already Built (Complete)

1. **5-step report form** — photo, GPS, damage level, infra type, additional info
2. **Voice-to-Report** — mic + text fallback, NLP detects damage/crisis/needs in 6 languages
3. **Client-side AI damage classification** — @xenova/transformers, ONNX, no API key
4. **Analyst dashboard** — real-time SSE, map, filters, export CSV/GeoJSON
5. **AI SITREP generator** — Groq/Llama 3.3, UN-style narrative, 6 languages, WhatsApp/email share
6. **AI Insights panel** — 3 data-driven observations on demand
7. **Photo evidence gallery** — thumbnail grid of priority reports
8. **Mass incident auto-detection** — 3+ critical reports in ~1km → alert banner
9. **Needs heatmap** — per-need-type layer (rescue/medical/water/food/shelter/electricity)
10. **Response dispatch tracker** — mark reports as responded, removes from priority queue
11. **Description auto-translation** — any report description → any UN language via Groq
12. **Estimated population affected** — shown in stats bar and SITREP
13. **Offline PWA** — IndexedDB queue, auto-sync, service worker
14. **6 UN languages** — English, Arabic (RTL), Chinese, French, Russian, Spanish
15. **Badge system**, duplicate detection, EXIF stripping, rate limiting, PostGIS spatial queries
16. **Auto-seed on empty DB** — seeds 80 demo reports on first startup if DB is empty
17. **One-click setup scripts** — setup.sh (Linux), setup.ps1 (Windows)

---

## What Needs Doing: DEPLOYMENT

### Target Stack (all free, no credit card needed)

| Service | Purpose | URL |
|---|---|---|
| **Neon** | PostgreSQL + PostGIS | neon.tech |
| **Cloudflare R2** | Photo/thumbnail storage (S3-compatible) | cloudflare.com → R2 |
| **Railway** | Backend Node.js API | railway.app |
| **Vercel** | Frontend React app | vercel.com |

All sign up via GitHub — no credit card.

---

### Step 1: Neon (PostgreSQL + PostGIS)

1. Sign up at **neon.tech** with GitHub
2. Create project → name: `rapida`, region: Europe (or closest to user)
3. Copy the connection string — looks like:
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Go to Neon dashboard → **SQL Editor**
5. Run the entire contents of `db/init.sql` from the repo (creates tables, PostGIS indexes, materialized view)

### Step 2: Cloudflare R2 (Object Storage)

1. Sign up at **cloudflare.com**
2. Go to **R2 Object Storage** in the sidebar
3. Create bucket named `crisis-reports`
4. In bucket settings → enable **Public access** (so photo URLs are publicly readable)
5. Copy the **public bucket URL** (looks like `https://pub-xxx.r2.dev` or the custom domain)
6. Go to **R2 → Manage R2 API Tokens → Create API Token**
   - Permissions: Object Read & Write for the `crisis-reports` bucket
   - Copy: **Access Key ID** and **Secret Access Key**
7. Copy your **Cloudflare Account ID** (shown in the R2 page URL)

R2 endpoint format: `<ACCOUNT_ID>.r2.cloudflarestorage.com`

### Step 3: Railway (Backend)

1. Sign up at **railway.app** with GitHub ($5 free credit given on signup)
2. New Project → **Deploy from GitHub repo** → select `rapida-crisis-mapping`
3. Railway reads `railway.json` automatically (already in the repo)
4. Go to **Variables** tab and add ALL of these:

```
DATABASE_URL=<neon connection string from step 1>
MINIO_ENDPOINT=<cloudflare-account-id>.r2.cloudflarestorage.com
MINIO_PORT=443
MINIO_ACCESS_KEY=<R2 access key ID from step 2>
MINIO_SECRET_KEY=<R2 secret access key from step 2>
MINIO_BUCKET=crisis-reports
MINIO_USE_SSL=true
MINIO_PUBLIC_URL=<public bucket URL from step 2>
DASHBOARD_API_KEY=rapida-dev-key-2026
GROQ_API_KEY=YOUR_GROQ_API_KEY  ← check your .env file or console.groq.com
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://<your-vercel-url>.vercel.app
IP_HASH_SALT=rapida-salt-2026
```

5. Railway will deploy automatically. Wait for it to go green.
6. Copy the Railway backend URL (looks like `https://rapida-xxx.railway.app`)

### Step 4: Vercel (Frontend)

1. Sign up at **vercel.com** with GitHub
2. New Project → import `rapida-crisis-mapping`
3. Framework: **Vite** (auto-detected)
4. Root directory: `frontend`
5. Build command: `npm run build`
6. Output directory: `dist`
7. Add these environment variables:
```
VITE_API_BASE_URL=https://<your-railway-url>.railway.app/api/v1
VITE_DASHBOARD_KEY=rapida-dev-key-2026
VITE_ENABLE_AI=true
VITE_MINIO_PUBLIC_URL=<R2 public bucket URL>
```
8. Deploy. Copy the Vercel URL (e.g. `https://rapida-crisis-mapping.vercel.app`)

### Step 5: Final Wiring

1. Go back to Railway → Variables → update `CORS_ORIGINS` to the actual Vercel URL
2. Go to Railway → Deployments → redeploy (to pick up CORS change)
3. Go back to README.md → update the "deployment in progress" line with the live URL:
   ```
   > **Live demo:** https://rapida-crisis-mapping.vercel.app
   ```
4. Commit and push the README update

### Step 6: Keep Railway Awake (Optional but recommended)

Railway free tier may sleep after inactivity. Set up a free ping:
1. Go to **uptimerobot.com** → sign up free
2. Add monitor → HTTP → URL: `https://<railway-url>.railway.app/api/v1/health`
3. Interval: every 5 minutes

---

## Live Deployment URLs

| Service | URL |
|---|---|
| **App (Frontend)** | https://rapida-crisis-mapping.vercel.app |
| **Backend API** | https://rapida-crisis-mapping-production.up.railway.app |
| **Health check** | https://rapida-crisis-mapping-production.up.railway.app/api/v1/health |
| **Dashboard key** | `rapida-dev-key-2026` |

---

## Testing After Deployment

Open the Vercel URL and verify:
- [ ] Report submission form loads
- [ ] Can take/upload a photo
- [ ] GPS works
- [ ] Report submits successfully and shows success screen with map pin
- [ ] Report appears in dashboard within 60s
- [ ] Dashboard shows the map with markers
- [ ] AI SITREP button works on situation-report page (enter key: `rapida-dev-key-2026`)
- [ ] AI Insights button works on dashboard
- [ ] Translate button on a report description works
- [ ] All 6 languages switchable in header
- [ ] Arabic shows RTL layout

---

## Local Dev Setup (if needed on the new PC)

```bash
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
chmod +x setup.sh && ./setup.sh
# Then add Groq key to .env
./start-dev.sh
```

App runs at http://localhost:5174 (or 5173)
Backend runs at http://localhost:3001

---

## Key Files

| File | Purpose |
|---|---|
| `frontend/src/pages/SituationReport.jsx` | SITREP + AI narrative page |
| `frontend/src/components/Dashboard/index.jsx` | Main dashboard |
| `frontend/src/components/Dashboard/MapView.jsx` | Map + heatmaps |
| `frontend/src/components/ReportForm/VoiceReportModal.jsx` | Voice-to-report modal |
| `frontend/src/hooks/useVoiceInput.js` | Web Speech API hook |
| `frontend/src/utils/parseVoiceInput.js` | NLP field detection |
| `backend/src/routes/analytics.js` | AI endpoints (translate, alerts, insights, SITREP) |
| `backend/src/services/analytics.js` | Data queries + population estimate |
| `backend/src/services/storage.js` | MinIO/S3 photo handling |
| `backend/scripts/seed.js` | Demo data seeder (auto-runs on empty DB) |
| `db/init.sql` | PostgreSQL + PostGIS schema |

---

## Notes

- The Groq API key above may need rotating after June 23 — get a new one free at console.groq.com
- Dashboard API key for evaluators: `rapida-dev-key-2026`
- Seed data covers 7 crisis zones: Antakya, Derna, Kharkiv, Addis Ababa, Marrakech, Lahore, Port-au-Prince
- The backend auto-seeds 80 reports on first startup if the reports table is empty
- PostGIS is required — plain Postgres won't work. Neon.tech has it.
