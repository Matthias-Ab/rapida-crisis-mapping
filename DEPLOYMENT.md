# RAPIDA Crisis Mapping — Deployment Guide

This guide covers everything needed to deploy the RAPIDA platform from a fresh server to a production-hardened, HTTPS-enabled installation. It is intended for UNDP technical evaluators and system administrators.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Docker Compose Deployment](#2-docker-compose-deployment)
   - [Development / Demo](#21-development--demo)
   - [Production](#22-production)
3. [Environment Variable Reference](#3-environment-variable-reference)
4. [SSL / TLS with Let's Encrypt](#4-ssltls-with-lets-encrypt)
5. [MinIO Bucket Configuration](#5-minio-bucket-configuration)
6. [Database Backup Strategy](#6-database-backup-strategy)
7. [Monitoring](#7-monitoring)
8. [Scaling Considerations](#8-scaling-considerations)
9. [Troubleshooting](#9-troubleshooting)
10. [Update and Rollback Procedure](#10-update-and-rollback-procedure)

---

## 1. Prerequisites

### Hardware (minimum)

| Component | Development | Production |
|---|---|---|
| CPU | 2 vCPU | 2 vCPU (4 recommended) |
| RAM | 2 GB | 4 GB (8 GB recommended) |
| Disk | 20 GB SSD | 80 GB SSD (plus photo storage) |
| Network | Any | Static IP + DNS A record |

### Software

| Dependency | Minimum Version | Install command (Ubuntu 22.04) |
|---|---|---|
| Docker Engine | 24.0 | `curl -fsSL https://get.docker.com \| sh` |
| Docker Compose | v2.20 (plugin) | Included with Docker Engine 24+ |
| Git | 2.x | `apt-get install -y git` |
| curl | any | `apt-get install -y curl` |
| openssl | any | `apt-get install -y openssl` |

Check your Docker Compose version:

```bash
docker compose version      # v2 (preferred)
docker-compose --version    # v1 (also works)
```

All examples below use `docker-compose` (v1 syntax). Substitute `docker compose` (with a space, no hyphen) if you are using v2 exclusively.

### Ports required

| Port | Service | Notes |
|---|---|---|
| 80 | Nginx (HTTP) | Redirects to 443 in production |
| 443 | Nginx (HTTPS) | Production only |
| 5432 | PostgreSQL | Development only (not exposed in prod) |
| 9000 | MinIO API | Development only (not exposed in prod) |
| 9001 | MinIO Console | Development only (not exposed in prod) |
| 3001 | Backend API | Development only (not exposed in prod) |

---

## 2. One-Click Setup Scripts (Recommended for First-Time Setup)

For local development and demo environments, use the platform-specific setup scripts included in the repository root. They handle all prerequisites, install dependencies, create `.env`, start Docker services, and build the frontend automatically.

### Linux / macOS

```bash
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
chmod +x setup.sh && ./setup.sh
```

After setup, add your Groq API key to `.env` (required for AI features):

```bash
# Replace YOUR_GROQ_API_KEY with your key from https://console.groq.com
sed -i 's/YOUR_GROQ_API_KEY/your_actual_key/' .env
```

Start in dev mode with hot reload:

```bash
./start-dev.sh
```

Or start the full Docker stack:

```bash
docker compose up -d
```

### Windows (PowerShell)

```powershell
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\setup.ps1
```

After setup, edit `.env` to set your Groq API key, then:

```powershell
.\start-dev.ps1     # dev mode with hot reload
# or
docker compose up -d  # full Docker stack
```

### Access Points (local)

| URL | Description |
|---|---|
| http://localhost:5173 | Report submission (public) |
| http://localhost:5173/dashboard | Analyst dashboard (key: `rapida-dev-key-2026`) |
| http://localhost:5173/situation-report | AI Situation Report + SITREP generator |
| http://localhost:9001 | MinIO console (`minioadmin` / `minioadmin`) |

---

## 3. Docker Compose Deployment (Manual)

### 3.1 Development / Demo

The development stack (`docker-compose.yml`) is suitable for local testing, demos, and UNDP evaluator review. It exposes every service port directly for easy debugging.

```bash
# Clone the repository
git clone https://github.com/Matthias-Ab/rapida-crisis-mapping
cd rapida-crisis-mapping

# Create the environment file
cp .env.example .env

# (Optional) Set a non-default DASHBOARD_API_KEY for the demo
sed -i 's/change_this_to_a_secure_random_key/demo_key_123/' .env

# Build images and start all services in the background
docker-compose up -d --build

# Tail logs to watch startup
docker-compose logs -f
```

Wait for all health checks to pass (typically 20–40 seconds):

```bash
docker-compose ps
# All services should show "healthy" or "running"
```

Access points:

| URL | Description |
|---|---|
| `http://localhost` | Submission form (port 80, via Nginx) |
| `http://localhost/dashboard` | Analyst dashboard |
| `http://localhost:3001/api/v1/health` | Backend health endpoint (direct) |
| `http://localhost:9001` | MinIO web console |

### 2.2 Production

The production stack (`docker-compose.prod.yml`) differs from development in the following ways:

- All services use `restart: always`
- CPU and memory limits are applied to every container
- PostgreSQL, MinIO, and the backend are **not** exposed on host ports — all traffic is routed through Nginx
- `NODE_ENV=production` is set on the backend (disables request logging, sets log level to `warn`)
- No default fallback values for secrets — all sensitive variables must be explicitly set in `.env`

```bash
# One-time: generate all secrets
DASHBOARD_API_KEY=$(openssl rand -hex 32)
IP_HASH_SALT=$(openssl rand -hex 16)
PG_PASSWORD=$(openssl rand -hex 20)
MINIO_AK=$(openssl rand -hex 20)
MINIO_SK=$(openssl rand -hex 20)

# Write to .env (adjust domain and paths as needed)
cat > .env <<EOF
DATABASE_URL=postgresql://crisis_user:${PG_PASSWORD}@postgres:5432/crisis_mapper
POSTGRES_USER=crisis_user
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=crisis_mapper

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=${MINIO_AK}
MINIO_SECRET_KEY=${MINIO_SK}
MINIO_BUCKET=crisis-reports
MINIO_USE_SSL=false

NODE_ENV=production
PORT=3001
DASHBOARD_API_KEY=${DASHBOARD_API_KEY}
IP_HASH_SALT=${IP_HASH_SALT}

CORS_ORIGINS=https://your-domain.com
VITE_API_BASE_URL=/api/v1
VITE_DASHBOARD_KEY=${DASHBOARD_API_KEY}
VITE_ENABLE_AI=true
EOF

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Verify health
curl -s http://localhost/api/v1/health | python3 -m json.tool
```

---

## 4. Environment Variable Reference

All variables are read from the `.env` file in the project root by Docker Compose. The backend also reads `backend/.env` when running manually outside Docker.

### Database

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Full Prisma connection string | `postgresql://crisis_user:pass@postgres:5432/crisis_mapper` |
| `POSTGRES_USER` | Yes (Docker) | PostgreSQL username created on first boot | `crisis_user` |
| `POSTGRES_PASSWORD` | Yes (Docker) | PostgreSQL password | `strongpassword` |
| `POSTGRES_DB` | Yes (Docker) | PostgreSQL database name | `crisis_mapper` |

### Object Storage

| Variable | Required | Description | Example |
|---|---|---|---|
| `MINIO_ENDPOINT` | Yes | Hostname or IP of the MinIO server | `minio` (Docker) / `localhost` |
| `MINIO_PORT` | Yes | MinIO API port | `9000` |
| `MINIO_ACCESS_KEY` | Yes | MinIO root access key | `minioadmin` |
| `MINIO_SECRET_KEY` | Yes | MinIO root secret key | `minioadmin` |
| `MINIO_BUCKET` | Yes | Bucket name for photo storage | `crisis-reports` |
| `MINIO_USE_SSL` | Yes | Whether to connect to MinIO over TLS | `false` / `true` |
| `MINIO_PUBLIC_URL` | No | Override base URL for photo URLs (useful behind a proxy) | `https://storage.your-domain.com` |

### Backend / API

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Runtime environment | `development` / `production` / `test` |
| `PORT` | Yes | Express server port | `3001` |
| `DASHBOARD_API_KEY` | Yes | Secret for `X-API-Key` header on protected routes. Generate: `openssl rand -hex 32` | _(strong random)_ |
| `IP_HASH_SALT` | No | Salt appended to IP before SHA-256 hashing. Generate: `openssl rand -hex 16` | _(strong random)_ |
| `CORS_ORIGINS` | Yes | Comma-separated allowed CORS origins | `https://your-domain.com` |
| `GROQ_API_KEY` | No* | Groq API key for AI SITREP narrative generation, AI Insights panel, and report description translation (Llama 3.3 70B). Free key at [console.groq.com](https://console.groq.com). *Required for AI features — they degrade gracefully (HTTP 503) if unset. | `gsk_...` |

### Frontend (baked in at build time by Vite)

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | API base URL as seen from the browser | `/api/v1` (Docker) |
| `VITE_DASHBOARD_KEY` | Yes | API key pre-filled on the dashboard login screen (must match `DASHBOARD_API_KEY`) | _(same as `DASHBOARD_API_KEY`)_ |
| `VITE_ENABLE_AI` | Yes | Enable/disable client-side AI inference | `true` |

> **Note on `VITE_*` variables:** These are embedded into the built JavaScript bundle at Docker image build time (not at runtime). If you change them, you must rebuild the frontend image with `docker-compose build frontend`.

---

## 5. SSL / TLS with Let's Encrypt

This section describes the recommended approach for a single-server deployment using Certbot in standalone mode.

### 4.1 Install Certbot

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

### 4.2 Stop Nginx to Free Port 80

```bash
docker-compose -f docker-compose.prod.yml stop nginx
```

### 4.3 Obtain the Certificate

```bash
sudo certbot certonly \
  --standalone \
  --agree-tos \
  --non-interactive \
  --email admin@your-domain.com \
  -d your-domain.com \
  -d www.your-domain.com
```

Certificates are written to `/etc/letsencrypt/live/your-domain.com/`.

### 4.4 Copy Certificates to the Docker SSL Directory

```bash
mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem  docker/ssl/privkey.pem
sudo chown $USER:$USER docker/ssl/*.pem
chmod 600 docker/ssl/privkey.pem
```

### 4.5 Create the Production Nginx Config

Create `docker/nginx.prod.conf` with the following content (replace `your-domain.com`):

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent"';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    sendfile       on;
    tcp_nopush     on;
    keepalive_timeout 65;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json
               application/javascript image/svg+xml font/truetype
               font/opentype application/vnd.ms-fontobject;

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
        ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:
                            ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache   shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_stapling        on;
        ssl_stapling_verify on;

        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(self), camera=(self)" always;

        # API proxy
        location /api/ {
            proxy_pass         http://backend;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s;
            proxy_connect_timeout 10s;
            client_max_body_size 20M;
            add_header Cache-Control "no-store" always;
            add_header X-Content-Type-Options "nosniff" always;
        }

        # Hashed static assets (long-lived cache)
        location ~* \.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp|avif)$ {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            expires 1y;
            add_header Cache-Control "public, immutable" always;
            add_header X-Content-Type-Options "nosniff" always;
        }

        # Service worker must never be cached
        location = /service-worker.js {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        }

        # PWA manifest
        location ~* \.(webmanifest|manifest\.json)$ {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            expires 1h;
        }

        # SPA catch-all
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 4.6 Restart Nginx with SSL

```bash
docker-compose -f docker-compose.prod.yml start nginx
```

Verify:

```bash
curl -I https://your-domain.com/api/v1/health
# Expect: HTTP/2 200 and Strict-Transport-Security header
```

### 4.7 Automatic Certificate Renewal

Certbot certificates expire every 90 days. Set up automatic renewal with a cron job (add to root crontab: `sudo crontab -e`):

```cron
# Renew certificates at 03:00 on the 1st and 15th of each month
0 3 1,15 * * certbot renew --quiet --pre-hook "docker stop rapida_nginx_1" \
  --post-hook "cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/rapida/docker/ssl/fullchain.pem && \
               cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/rapida/docker/ssl/privkey.pem && \
               docker start rapida_nginx_1"
```

Alternatively, use the `--deploy-hook` approach without stopping Nginx:

```cron
0 3 1,15 * * certbot renew --quiet \
  --deploy-hook "cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/rapida/docker/ssl/fullchain.pem && \
                 cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/rapida/docker/ssl/privkey.pem && \
                 docker-compose -f /path/to/rapida/docker-compose.prod.yml kill -s HUP nginx"
```

---

## 6. MinIO Bucket Configuration

MinIO stores all uploaded photos and thumbnails. The backend automatically creates the bucket and sets the bucket policy on startup (see `backend/src/services/storage.js`).

### 5.1 Bucket Policy

The startup routine applies the following policy:

- `thumbnails/*` objects are **publicly readable** (so the dashboard can display them without generating pre-signed URLs on every request)
- `photos/*` objects are **private** — full-resolution photos must be served via pre-signed URLs (7-day expiry by default)

If you need to inspect or modify the policy manually, use the MinIO Client (`mc`):

```bash
# Install mc
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc && sudo mv mc /usr/local/bin/

# Configure alias (development)
mc alias set rapida http://localhost:9000 minioadmin minioadmin

# View current policy
mc policy get rapida/crisis-reports

# List bucket contents
mc ls rapida/crisis-reports/
mc ls rapida/crisis-reports/photos/
mc ls rapida/crisis-reports/thumbnails/
```

### 5.2 Using a Custom Public URL for MinIO

If MinIO is behind a reverse proxy or CDN, set `MINIO_PUBLIC_URL` in `.env`:

```bash
MINIO_PUBLIC_URL=https://storage.your-domain.com
```

Photo and thumbnail URLs returned by the API will then use this base URL instead of the internal MinIO endpoint.

### 5.3 Connecting MinIO to an External S3-Compatible Service

RAPIDA uses the standard MinIO SDK (`minio` npm package), which is compatible with any S3-compliant service (AWS S3, Cloudflare R2, Backblaze B2, etc.). To use an external service:

```bash
MINIO_ENDPOINT=s3.amazonaws.com          # or your provider's endpoint
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<your access key id>
MINIO_SECRET_KEY=<your secret access key>
MINIO_BUCKET=rapida-crisis-reports
```

For AWS S3, ensure the bucket exists and the IAM user has `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, and `s3:PutBucketPolicy` permissions.

### 5.4 Pre-signed URL Configuration

Full-resolution photos are accessed via pre-signed URLs (default expiry: 7 days). To change the expiry, modify `storage.js`:

```javascript
// backend/src/services/storage.js
async function getSignedUrl(key, expiry = 604800) {  // 604800 = 7 days in seconds
  return client.presignedGetObject(BUCKET, key, expiry)
}
```

---

## 7. Database Backup Strategy

### 6.1 Manual Backup

To create a point-in-time backup of the PostgreSQL database:

```bash
# Get the container name
docker-compose -f docker-compose.prod.yml ps | grep postgres

# Run pg_dump inside the container
docker exec rapida_postgres_1 \
  pg_dump -U crisis_user crisis_mapper \
  | gzip > /backups/rapida-db-$(date +%Y%m%d-%H%M%S).sql.gz
```

### 6.2 Automated Daily Backups (Cron)

Add to the system crontab (`sudo crontab -e`) to run daily at 02:00 and keep 30 days of backups:

```cron
# Daily database backup
0 2 * * * docker exec rapida_postgres_1 \
  pg_dump -U crisis_user crisis_mapper \
  | gzip > /backups/rapida-db-$(date +\%Y\%m\%d).sql.gz 2>/var/log/rapida-backup.log

# Delete backups older than 30 days
0 3 * * * find /backups -name "rapida-db-*.sql.gz" -mtime +30 -delete
```

Create the backup directory:

```bash
sudo mkdir -p /backups
sudo chown $USER:$USER /backups
```

### 6.3 Backup MinIO Data

MinIO data is stored in a named Docker volume (`minio_data`). For photo backups:

```bash
# Copy MinIO volume to a tar archive
docker run --rm \
  -v rapida_minio_data:/data:ro \
  -v /backups:/backup \
  alpine \
  tar czf /backup/rapida-minio-$(date +%Y%m%d).tar.gz -C /data .
```

For production environments with large photo volumes, consider using `mc mirror` to sync to a secondary storage provider:

```bash
# Mirror to a second MinIO instance or S3 bucket
mc mirror rapida/crisis-reports minio-backup/crisis-reports
```

### 6.4 Restore from Backup

```bash
# Restore database
gunzip < /backups/rapida-db-20260615.sql.gz | \
  docker exec -i rapida_postgres_1 \
  psql -U crisis_user crisis_mapper

# Restore MinIO data (stop backend first to avoid concurrent writes)
docker-compose -f docker-compose.prod.yml stop backend
docker run --rm \
  -v rapida_minio_data:/data \
  -v /backups:/backup \
  alpine \
  tar xzf /backup/rapida-minio-20260615.tar.gz -C /data
docker-compose -f docker-compose.prod.yml start backend
```

---

## 8. Monitoring

### 7.1 Health Endpoint

The backend exposes a structured health endpoint that checks database and MinIO connectivity:

```bash
curl http://localhost/api/v1/health
```

Response fields:

| Field | Description |
|---|---|
| `status` | `ok` (all dependencies healthy) or `degraded` (one or more unreachable) |
| `db` | `connected` or `disconnected` |
| `db_latency_ms` | Round-trip time for a `SELECT 1` query in milliseconds |
| `storage` | `connected` or `disconnected` |
| `uptime_seconds` | Backend process uptime |
| `version` | Package version from `package.json` |

HTTP status codes: `200` when healthy, `207 Multi-Status` when degraded.

Use this endpoint with any uptime monitor (UptimeRobot, Prometheus Blackbox Exporter, etc.):

```bash
# Simple bash liveness check
if [ "$(curl -s http://localhost/api/v1/health | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")" != "ok" ]; then
  echo "RAPIDA health check FAILED at $(date)" | mail -s "RAPIDA Alert" admin@your-domain.com
fi
```

### 7.2 Container-Level Health Checks

All Docker Compose services have built-in health checks. Monitor them with:

```bash
# Show health status for all containers
docker-compose -f docker-compose.prod.yml ps

# Watch health events in real time
docker events --filter type=container --filter event=health_status
```

### 7.3 Log Aggregation

All services write to Docker's logging driver. View logs:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Single service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 200 lines of backend logs
docker-compose -f docker-compose.prod.yml logs --tail=200 backend
```

To forward logs to a centralised system (Loki, ELK, CloudWatch), configure the Docker logging driver in each service block within `docker-compose.prod.yml`:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

For Loki (Grafana):

```yaml
    logging:
      driver: loki
      options:
        loki-url: "http://loki:3100/loki/api/v1/push"
        loki-batch-size: "400"
```

### 7.4 Disk Usage

Monitor disk usage for the two data volumes:

```bash
# PostgreSQL data volume
docker system df -v | grep postgres_data

# MinIO data volume
docker system df -v | grep minio_data

# Or inspect via du inside container
docker exec rapida_postgres_1 du -sh /var/lib/postgresql/data
docker exec rapida_minio_1 du -sh /data
```

---

## 9. Scaling Considerations

### 8.1 Vertical Scaling

The fastest path to handling increased load is to increase the resource limits in `docker-compose.prod.yml`. The backend benefits most from additional CPU (photo processing via Sharp). PostgreSQL benefits from additional RAM for shared buffers.

### 8.2 Backend Horizontal Scaling

The backend is stateless. To run multiple backend replicas behind Nginx:

1. Update the `upstream backend` block in `nginx.prod.conf`:

```nginx
upstream backend {
    server backend_1:3001;
    server backend_2:3001;
    server backend_3:3001;
    keepalive 32;
}
```

2. Add replica services to `docker-compose.prod.yml` or migrate to Docker Swarm / Kubernetes.

> Note: The in-memory rate limiter (`express-rate-limit`) does not share state across replicas. For multi-instance deployments, replace it with `rate-limit-redis` and add a Redis service.

### 8.3 PostgreSQL Read Replicas

For high-read-throughput deployments (large analyst teams), add a streaming replica:

1. Configure `wal_level = replica` and `max_wal_senders = 3` in PostgreSQL.
2. Spin up a replica using `postgis/postgis:15-3.3` with `PGDATA` pointed to the primary via replication.
3. Direct `GET /reports`, `GET /export/*`, and `GET /analytics` queries to the replica connection string.

This is not required for MVP deployments.

### 8.4 MinIO Clustering

For multi-zone deployments or very large photo volumes (>1 TB), consider MinIO in Distributed mode or replace it with S3 / Cloudflare R2. All that is needed is to update the `MINIO_*` environment variables — the storage service code requires no changes.

### 8.5 CDN for Photos

Once photo volume grows, put a CDN (Cloudflare, CloudFront, Fastly) in front of MinIO's public `thumbnails/` prefix. Set `MINIO_PUBLIC_URL` to the CDN origin URL.

---

## 10. Troubleshooting

### Database container won't start / exits immediately

```bash
docker-compose logs postgres
```

Common causes:
- `POSTGRES_PASSWORD` not set (required in production Compose)
- Disk full — check `df -h`
- Incompatible data volume from a different PostgreSQL version — remove the volume: `docker-compose down -v` (destructive)

### Backend exits with "Cannot connect to database"

1. Confirm the PostgreSQL container is healthy: `docker-compose ps postgres`
2. Check `DATABASE_URL` in `.env` — hostname must match the service name (`postgres`, not `localhost`)
3. Wait longer — the backend has a `depends_on: condition: service_healthy` guard but in rare cases the first connection attempt may race the init script

### MinIO bucket policy returns 403

If photo URLs return 403, the bucket policy was not applied. Force re-application:

```bash
mc alias set rapida http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
mc policy set public rapida/crisis-reports/thumbnails
```

Or restart the backend, which calls `initializeBucket()` on startup.

### Photo upload returns 413 Entity Too Large

Nginx has a `client_max_body_size 20M` directive in the API location block. If you are still seeing 413, check whether you are bypassing Nginx (uploading directly to port 3001). The Express body parser limit is 1 MB for JSON, but `multer` handles multipart uploads separately (limit: 10 MB per file).

### Frontend shows blank page or "Failed to fetch"

1. Check that `VITE_API_BASE_URL` was set correctly **before** the Docker image was built
2. Verify Nginx is running and healthy: `docker-compose ps nginx`
3. Check CORS: the browser console will show CORS errors if `CORS_ORIGINS` in `.env` does not include the page's origin

### Dashboard returns 401

The `X-API-Key` header value must exactly match `DASHBOARD_API_KEY` in `.env`. If you changed the key after building, rebuild the frontend image (the dashboard login screen pre-fills `VITE_DASHBOARD_KEY`):

```bash
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

### High memory usage on backend

Sharp (libvips) can spike memory during concurrent photo processing. If the backend OOM-kills, increase the memory limit in `docker-compose.prod.yml`:

```yaml
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Disk full — MinIO photos

Check volume usage:

```bash
docker exec rapida_minio_1 du -sh /data/crisis-reports/photos/
```

Options:
- Delete old or flagged photos via the MinIO console or `mc rm`
- Expand the Docker volume by migrating data to a larger host path
- Enable MinIO lifecycle rules to auto-expire old photos

---

## 10. Update and Rollback Procedure

### 10.1 Standard Update

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime for Nginx and frontend; brief backend restart)
docker-compose -f docker-compose.prod.yml up -d --build --remove-orphans

# Apply any pending database migrations
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy

# Confirm health
curl http://localhost/api/v1/health
```

### 10.2 Rollback to a Previous Version

Tag each deployment so you can roll back by image tag:

```bash
# Tag current images before updating
docker tag $(docker-compose images -q backend) rapida/backend:$(date +%Y%m%d)
docker tag $(docker-compose images -q frontend) rapida/frontend:$(date +%Y%m%d)

# To roll back, edit docker-compose.prod.yml to pin the image tag:
#   image: rapida/backend:20260615
# Then:
docker-compose -f docker-compose.prod.yml up -d
```

### 10.3 Rolling Back a Database Migration

Prisma does not natively support down migrations. The recommended approach is to restore from the pre-migration backup:

```bash
# Stop the backend to prevent new writes
docker-compose -f docker-compose.prod.yml stop backend

# Restore from backup
gunzip < /backups/rapida-db-YYYYMMDD.sql.gz | \
  docker exec -i rapida_postgres_1 \
  psql -U crisis_user crisis_mapper

# Restart with the previous backend image
docker-compose -f docker-compose.prod.yml start backend
```

For non-destructive schema changes (adding nullable columns, creating indexes), a rollback is usually unnecessary — the previous backend code is compatible with the new schema.

### 10.4 Checking the Current Schema Version

```bash
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate status
```

### 10.5 Environment Variable Changes

If you modify any `VITE_*` variable in `.env`, the frontend Docker image must be rebuilt because Vite bakes environment variables into the JavaScript bundle at build time:

```bash
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

Backend-only variable changes (e.g., `DASHBOARD_API_KEY`, `CORS_ORIGINS`) take effect after a container restart without rebuilding:

```bash
docker-compose -f docker-compose.prod.yml up -d backend
```

---

*For questions or issues, open a GitHub issue at https://github.com/Matthias-Ab/rapida-crisis-mapping.*
