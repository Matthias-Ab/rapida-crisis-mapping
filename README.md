# RAPIDA — Community Crisis Reporting Platform

[![UNDP / InnoCentive Challenge](https://img.shields.io/badge/UNDP%20InnoCentive-Crisis%20Mapping%20Challenge-009edb?style=flat-square)](https://innocentive.com)
[![CI](https://img.shields.io/github/actions/workflow/status/Matthias-Ab/rapida-crisis-mapping/ci.yml?style=flat-square&label=CI)](https://github.com/Matthias-Ab/rapida-crisis-mapping/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/Matthias-Ab/rapida-crisis-mapping/pulls)

---

## What is RAPIDA?

RAPIDA is a fully open-source, mobile-first Progressive Web App (PWA) built for the United Nations Development Programme (UNDP) to enable rapid community-driven crisis damage reporting. When disaster strikes — earthquake, flood, conflict, or wildfire — RAPIDA allows anyone with a smartphone to photograph damaged infrastructure, classify the severity of damage, pin the location on a map, and submit a structured report in seconds. Reports are transmitted in real time to a live analyst dashboard that UNDP field coordinators use to prioritise response, allocate resources, and coordinate recovery efforts. The system works in areas with degraded or intermittent connectivity: reports are queued locally in the browser and automatically synchronised the moment the device reconnects.

The platform is designed around three core principles: **anonymity** (no personal data is ever collected — reports are linked only to an ephemeral session UUID), **resilience** (offline-first architecture means reporting is never blocked by poor network conditions), and **accessibility** (all text is available in all six official UN languages, with full right-to-left layout support for Arabic, and the UI is optimised for use outdoors in bright light on low-cost Android devices). RAPIDA is submitted as an entry to the UNDP / InnoCentive "Build the Future of Crisis Mapping" challenge.

---

## Features

**Reporting (Public / Field)**
- Mobile-first submission form designed for 375 px screens, usable in full sunlight
- In-browser AI damage classification powered by `@xenova/transformers` (ONNX — no API key, no server round-trip) — provides a suggested damage level with confidence percentage after the user selects a photo
- Camera capture or gallery upload; photo processed server-side with Sharp (resize to 1920 px, strip EXIF metadata for privacy, generate 400 px thumbnail)
- GPS auto-detection with reverse geocoding via Nominatim; manual fallback via landmark text field
- Interactive Leaflet map with building footprint overlay (OpenStreetMap / Overpass API) — tap a footprint to capture its OSM ID
- Three structured damage levels: None / Minimal, Partially Damaged, Completely Damaged
- Nine crisis types: Earthquake, Flood, Tsunami, Hurricane/Cyclone, Wildfire, Explosion, Chemical Incident, Conflict, Civil Unrest
- Eight infrastructure categories: Residential, Commercial, Government, Utility, Transport & Communication, Community, Public/Recreation, Other
- Additional fields: debris present, electricity status, health services status, pressing needs (multi-select), free-text description (500 chars)
- Contribution badge system (First Responder through Community Guardian) stored in localStorage — no login required
- Full privacy notice on all submission screens; data notice affirms no PII is collected

**Offline / PWA**
- Installs to Android/iOS home screen as a standalone PWA
- Workbox service worker precaches all app assets; OpenStreetMap tiles cached (Cache-First, up to 500 tiles, 7-day expiry)
- Reports queued in IndexedDB (Dexie.js) when submitted offline; auto-synced on network reconnect with persistent banner showing queue count
- Background Sync API registration for `sync-reports` tag

**Analyst Dashboard (Protected)**
- Full-screen Leaflet map with colour-coded circle markers (green / amber / red by damage level)
- Marker clustering (Leaflet.markercluster) at low zoom; heatmap toggle layer (Leaflet.heat)
- Click any marker to open a popup with thumbnail, damage classification badges, infrastructure type, crisis type, timestamp, and full-report link
- Real-time polling every 60 seconds for new reports
- Filter sidebar: date range, damage level, infrastructure type, crisis type, flagged-only toggle, unverified-only toggle
- Stats bar: total reports, reports today, unique buildings affected, most common damage level
- One-click CSV export (filtered or all, up to 100,000 rows)
- One-click GeoJSON export (filtered or all, compatible with QGIS and ArcGIS)

**Internationalisation**
- All six official UN languages: English, Arabic (ar), Chinese Simplified (zh), French (fr), Russian (ru), Spanish (es)
- Full RTL layout for Arabic using CSS logical properties
- Language detection: URL `?lang=` param → localStorage → browser language → English fallback
- All labels, validation messages, offline banners, and confirmation text are translated

**API**
- RESTful JSON API under `/api/v1`
- GeoJSON-native report retrieval with bounding-box spatial filtering (PostGIS `ST_Within`)
- Duplicate detection: reports within 50 m of the same building submitted by the same session within 30 minutes are flagged automatically
- Rate limiting: 10 submissions per session per hour; 100 API requests per IP per minute
- Public crowdsource flagging (`POST /reports/:id/flag`, rate-limited to 5 per IP per hour)

**Security**
- EXIF metadata stripped from all photos before storage (Sharp)
- IP addresses stored only as SHA-256 hashes (salted via `IP_HASH_SALT`)
- Dashboard routes protected by `X-API-Key` header
- Helmet.js security headers; strict CORS allowlist in production
- All user input validated and sanitised with express-validator
- Prisma ORM with parameterised queries throughout (no raw SQL with user input)
- No PII collected; anonymous session UUIDs only

**Infrastructure**
- Docker Compose stack: PostgreSQL 15 + PostGIS, MinIO object storage, Node.js/Express backend, React/Vite frontend, Nginx reverse proxy
- Production Compose file (`docker-compose.prod.yml`) with `restart: always`, resource limits, and no exposed database/storage ports
- GitHub Actions CI: lint, Jest backend tests (with real PostGIS container), Vitest frontend tests, Docker build validation, coverage reporting on PRs

---

## Screenshots

| Submission Form (mobile) | Analyst Dashboard |
|:---:|:---:|
| ![Submit form](screenshots/submit-form.png) | ![Dashboard](screenshots/dashboard.png) |

---

## Live Demo

> To deploy your own instance, see [DEPLOYMENT.md](DEPLOYMENT.md) or use one of the one-click options below.

### One-click deploy options

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)
[![Deploy to Fly.io](https://img.shields.io/badge/Deploy%20to-Fly.io-purple?style=for-the-badge&logo=fly.io)](https://fly.io)

---

## Quick Start (Docker)

> **Requirements:** Docker 24+ and Docker Compose v2 (`docker compose`), or Docker Compose v1 (`docker-compose`).

```bash
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
cp .env.example .env
# Edit .env and set DASHBOARD_API_KEY to a strong random secret:
#   openssl rand -hex 32
docker-compose up -d
```

Wait approximately 30 seconds for all services to pass their health checks, then open:

- **http://localhost** — public damage report submission form
- **http://localhost/dashboard** — analyst dashboard (requires `DASHBOARD_API_KEY` in the `X-API-Key` header, or the dashboard login screen)
- **http://localhost:9001** — MinIO console (access key / secret key from `.env`)

To follow logs:

```bash
docker-compose logs -f backend
```

To stop:

```bash
docker-compose down
```

To stop and remove all data volumes (destructive):

```bash
docker-compose down -v
```

---

## Manual Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15 with the PostGIS 3.3 extension installed
- MinIO server (or any S3-compatible endpoint)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env to point DATABASE_URL and MINIO_* at your local services
npm install
npx prisma migrate dev        # runs migrations and generates the Prisma client
npm run dev                   # nodemon watches for changes on port 3001
```

Apply the PostGIS schema once:

```bash
psql "$DATABASE_URL" -f ../db/init.sql
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:3001`, so the backend and frontend can run independently.

### Running tests

```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npm test
```

---

## Environment Variables

All configuration is driven by environment variables. Copy `.env.example` to `.env` at the project root (for Docker Compose) and `backend/.env.example` to `backend/.env` (for manual development runs).

**Never commit `.env` files containing real secrets.**

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Prisma format) | `postgresql://crisis_user:changeme@postgres:5432/crisis_mapper` |
| `POSTGRES_USER` | PostgreSQL superuser name (Docker only) | `crisis_user` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password (Docker only) | `changeme` |
| `POSTGRES_DB` | PostgreSQL database name (Docker only) | `crisis_mapper` |
| `MINIO_ENDPOINT` | MinIO / S3 hostname | `minio` (Docker) or `localhost` (manual) |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO root access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO root secret key | `minioadmin` |
| `MINIO_BUCKET` | Bucket name for photo storage | `crisis-reports` |
| `MINIO_USE_SSL` | Use HTTPS for MinIO connections | `false` |
| `MINIO_PUBLIC_URL` | Optional public base URL for MinIO (when behind a proxy) | _(unset)_ |
| `NODE_ENV` | Node environment (`development`, `production`, `test`) | `development` |
| `PORT` | Backend HTTP port | `3001` |
| `DASHBOARD_API_KEY` | Secret key required in `X-API-Key` header for protected routes. Generate with `openssl rand -hex 32` | _(must be set)_ |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173,https://your-domain.com` |
| `IP_HASH_SALT` | Random salt appended to client IPs before SHA-256 hashing. Generate with `openssl rand -hex 16` | _(optional but recommended)_ |
| `VITE_API_BASE_URL` | API base URL baked into the frontend at build time | `/api/v1` (Docker) or `http://localhost:3001/api/v1` (manual) |
| `VITE_DASHBOARD_KEY` | Dashboard API key baked into the frontend (used by the dashboard login screen) | _(must match `DASHBOARD_API_KEY`)_ |
| `VITE_ENABLE_AI` | Enable/disable client-side AI damage classification | `true` |

---

## API Documentation

### Base URL

`/api/v1` (relative, proxied through Nginx in Docker)

### Authentication

Protected endpoints require the `X-API-Key` header:

```
X-API-Key: <your DASHBOARD_API_KEY>
```

Requests without a valid key receive `HTTP 401`.

---

### POST /api/v1/reports

Submit a damage report. Accepts `multipart/form-data`.

**Required fields:** `photo` (JPEG/PNG/WEBP, max 10 MB), `latitude`, `longitude`, `damage_level`, `infra_type`, `crisis_type`, `session_id` (UUID v4).

**Optional fields:** `description` (max 500 chars), `building_id`, `location_text`, `what3words`, `infra_name`, `debris_present`, `electricity_status`, `health_services_status`, `pressing_needs` (JSON array), `language`.

```bash
curl -X POST http://localhost/api/v1/reports \
  -F "photo=@/path/to/photo.jpg" \
  -F "latitude=40.7128" \
  -F "longitude=-74.0060" \
  -F "damage_level=partial" \
  -F "infra_type=residential" \
  -F "crisis_type=earthquake" \
  -F "session_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "description=Roof collapsed on north side" \
  -F "debris_present=true"
```

**Response 201:**
```json
{
  "id": "a3f7b2c1-...",
  "created_at": "2026-06-15T10:30:00Z",
  "photo_url": "http://minio:9000/crisis-reports/photos/...",
  "thumbnail_url": "http://minio:9000/crisis-reports/thumbnails/...",
  "is_duplicate": false,
  "duplicate_of": null
}
```

**Error 400** — validation failure with per-field details.
**Error 429** — rate limit exceeded (10 reports per session per hour).

---

### GET /api/v1/reports

Fetch reports as a GeoJSON FeatureCollection. Requires `X-API-Key`.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `bbox` | string | Bounding box filter: `minLng,minLat,maxLng,maxLat` |
| `damage_level` | string | Comma-separated: `none`, `partial`, `complete` |
| `crisis_type` | string | Comma-separated crisis type values |
| `infra_type` | string | Comma-separated infrastructure type values |
| `from` | ISO 8601 | Include reports created after this date |
| `to` | ISO 8601 | Include reports created before this date |
| `flagged` | `true`/`false` | Filter by flagged status |
| `verified` | `true`/`false` | Filter by verified status |
| `limit` | integer | Max results (default 1000, max 5000) |
| `offset` | integer | Pagination offset (default 0) |

```bash
curl -H "X-API-Key: your_key" \
  "http://localhost/api/v1/reports?bbox=44.2,33.1,44.8,33.7&damage_level=complete,partial&limit=500"
```

**Response 200:** GeoJSON `FeatureCollection` with `total`, `returned`, `limit`, `offset` metadata fields.

---

### GET /api/v1/reports/:id

Get full detail for a single report. No authentication required (used for public share links).

Returns all report fields except `ip_hash` and `session_id`.

```bash
curl http://localhost/api/v1/reports/a3f7b2c1-e29b-41d4-a716-446655440001
```

---

### GET /api/v1/export/csv

Export reports as a downloadable CSV file. Requires `X-API-Key`.

Accepts the same filter parameters as `GET /reports`. Limit up to 100,000 rows. Returns `Content-Type: text/csv` with `Content-Disposition: attachment`.

```bash
curl -H "X-API-Key: your_key" \
  "http://localhost/api/v1/export/csv?crisis_type=flood&from=2026-06-01" \
  -o flood-reports.csv
```

CSV columns: `id`, `created_at`, `latitude`, `longitude`, `building_id`, `location_text`, `damage_level`, `infra_type`, `infra_name`, `crisis_type`, `description`, `debris_present`, `electricity_status`, `health_services_status`, `pressing_needs`, `language`, `is_flagged`, `is_verified`.

---

### GET /api/v1/export/geojson

Export reports as a GeoJSON FeatureCollection file. Requires `X-API-Key`.

Accepts the same filter parameters as `GET /reports`. Returns a `.geojson` file importable by QGIS, ArcGIS, or any GIS tool.

```bash
curl -H "X-API-Key: your_key" \
  "http://localhost/api/v1/export/geojson?bbox=44.2,33.1,44.8,33.7" \
  -o area-reports.geojson
```

---

### GET /api/v1/analytics

Returns aggregated statistics across all reports. Requires `X-API-Key`.

```bash
curl -H "X-API-Key: your_key" http://localhost/api/v1/analytics
```

**Response 200:**
```json
{
  "total_reports": 12450,
  "by_damage_level": { "none": 1200, "partial": 7300, "complete": 3950 },
  "by_infra_type": { "residential": 6700, "community": 2100 },
  "by_crisis_type": { "earthquake": 9000, "flood": 3450 },
  "reports_last_24h": 890,
  "reports_last_1h": 45,
  "unique_buildings_affected": 3200,
  "flagged_reports": 34,
  "verified_reports": 1102
}
```

---

### POST /api/v1/reports/:id/flag

Flag a report for moderator review. No authentication required. Rate-limited to 5 flags per IP per hour.

```bash
curl -X POST http://localhost/api/v1/reports/a3f7b2c1-e29b-41d4-a716-446655440001/flag
```

**Response 200:**
```json
{
  "id": "a3f7b2c1-...",
  "is_flagged": true,
  "message": "Report has been flagged for review"
}
```

---

### GET /api/v1/health

Liveness and readiness probe. No authentication required.

```bash
curl http://localhost/api/v1/health
```

**Response 200 (all healthy):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "environment": "production",
  "db": "connected",
  "db_latency_ms": 3,
  "storage": "connected",
  "timestamp": "2026-06-15T10:30:00Z",
  "uptime_seconds": 86400
}
```

Returns `HTTP 207` with `"status": "degraded"` if either the database or MinIO is unreachable.

---

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │              Docker Network              │
                          │                                          │
  User Browser (PWA)      │  ┌──────────┐    ┌──────────────────┐  │
  ┌─────────────────┐     │  │          │    │    Frontend       │  │
  │  React + Vite   │────────▶  Nginx   │───▶│  (React / Vite)  │  │
  │  Service Worker │     │  │  :80/443 │    │  Served by Nginx  │  │
  │  IndexedDB Queue│     │  │          │    └──────────────────┘  │
  └─────────────────┘     │  │          │                           │
                          │  │          │    ┌──────────────────┐  │
                          │  │ /api/v1/ │    │    Backend        │  │
                          │  │          │───▶│  (Node/Express)  │  │
                          │  │          │    │  Prisma ORM      │  │
                          │  └──────────┘    └────────┬─────────┘  │
                          │                           │             │
                          │              ┌────────────┴──────────┐  │
                          │              │                       │  │
                          │  ┌───────────▼──────┐  ┌────────────▼┐ │
                          │  │   PostgreSQL 15   │  │    MinIO    │ │
                          │  │   + PostGIS 3.3   │  │  (photos /  │ │
                          │  │   reports table   │  │  thumbnails)│ │
                          │  │   spatial indexes │  │             │ │
                          │  └───────────────────┘  └─────────────┘ │
                          └─────────────────────────────────────────┘

  Data flow (report submission):
  Browser → Nginx (:80) → Backend (:3001) → Sharp (resize+strip EXIF)
         → MinIO (store photo) → PostgreSQL (insert report)
         → Browser ← 201 { id, photo_url, thumbnail_url }

  Data flow (dashboard):
  Browser → Nginx (:80) → Backend (:3001) → PostgreSQL (GeoJSON query)
         → Browser ← GeoJSON FeatureCollection
```

---

## Deployment to Production

### 1. Server Requirements

- Ubuntu 22.04 LTS (recommended)
- 2 vCPU, 4 GB RAM minimum (8 GB recommended for 10,000+ daily reports)
- 40 GB SSD (more if storing many photos)
- Docker Engine 24+ and Docker Compose v2
- Ports 80 and 443 open in firewall

Install Docker on Ubuntu 22.04:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the Repository and Configure Environment

```bash
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
cp .env.example .env
```

Edit `.env` and set **all** of the following to production-grade values:

```bash
# Generate strong secrets:
openssl rand -hex 32   # use output for DASHBOARD_API_KEY
openssl rand -hex 16   # use output for IP_HASH_SALT
openssl rand -hex 20   # use output for POSTGRES_PASSWORD
openssl rand -hex 20   # use output for MINIO_ACCESS_KEY
openssl rand -hex 20   # use output for MINIO_SECRET_KEY

# Required edits in .env:
POSTGRES_PASSWORD=<generated>
MINIO_ACCESS_KEY=<generated>
MINIO_SECRET_KEY=<generated>
DASHBOARD_API_KEY=<generated>
IP_HASH_SALT=<generated>
CORS_ORIGINS=https://your-domain.com
VITE_API_BASE_URL=/api/v1
VITE_DASHBOARD_KEY=<same as DASHBOARD_API_KEY>
VITE_ENABLE_AI=true
```

### 3. Start the Production Stack

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Verify all containers are healthy:

```bash
docker-compose -f docker-compose.prod.yml ps
```

Check the health endpoint:

```bash
curl http://localhost/api/v1/health
```

### 4. SSL Setup with Let's Encrypt

Install Certbot:

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

Stop Nginx temporarily to allow Certbot to bind port 80:

```bash
docker-compose -f docker-compose.prod.yml stop nginx
```

Obtain a certificate:

```bash
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

Certificates are written to `/etc/letsencrypt/live/your-domain.com/`.

Copy them to the Docker SSL directory:

```bash
mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/
sudo chown $USER:$USER docker/ssl/*.pem
chmod 600 docker/ssl/*.pem
```

### 5. Nginx SSL Configuration

The production Compose file (`docker-compose.prod.yml`) mounts `./docker/nginx.prod.conf`. Create that file as follows (replace `your-domain.com`):

```nginx
worker_processes auto;

events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile on;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    upstream backend  { server backend:3001;  keepalive 32; }
    upstream frontend { server frontend:80;   keepalive 16; }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache   shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_stapling        on;
        ssl_stapling_verify on;

        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location /api/ {
            proxy_pass         http://backend;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s;
            client_max_body_size 20M;
            add_header Cache-Control "no-store" always;
        }

        location ~* \.(js|css|woff2?|png|jpg|jpeg|gif|ico|svg|webp)$ {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable" always;
        }

        location = /service-worker.js {
            proxy_pass http://frontend;
            add_header Cache-Control "no-store" always;
        }

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

Restart Nginx:

```bash
docker-compose -f docker-compose.prod.yml start nginx
```

Set up automatic certificate renewal (add to root crontab with `sudo crontab -e`):

```cron
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/rapida/docker/ssl/ && \
  cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/rapida/docker/ssl/ && \
  docker-compose -f /path/to/rapida/docker-compose.prod.yml kill -s HUP nginx
```

---

## License

MIT License. Copyright (c) 2026 RAPIDA Crisis Mapping Contributors. See [LICENSE](LICENSE) for full terms.

This project is submitted to the UNDP / InnoCentive "Build the Future of Crisis Mapping" challenge and is free for any organisation to deploy, adapt, and build upon under the terms of the MIT License.
