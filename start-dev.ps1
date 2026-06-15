# ============================================================
# RAPIDA — Start dev environment on Windows (hot reload)
# Runs backend + frontend natively; uses Docker for DB + MinIO
# ============================================================

Write-Host "Starting RAPIDA in dev mode..." -ForegroundColor Cyan

# Ensure DB and MinIO are running
docker compose up -d postgres minio 2>$null

# Wait for postgres
Write-Host "Waiting for database" -NoNewline -ForegroundColor Gray
for ($i = 0; $i -lt 20; $i++) {
    $r = docker compose exec -T postgres pg_isready -U crisis_user -q 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green; break }
    Write-Host "." -NoNewline
    Start-Sleep 1
}

# Backend env vars
$env:DATABASE_URL    = "postgresql://crisis_user:changeme@localhost:5432/crisis_mapper"
$env:MINIO_ENDPOINT  = "localhost"
$env:MINIO_PORT      = "9000"
$env:MINIO_ACCESS_KEY = "minioadmin"
$env:MINIO_SECRET_KEY = "minioadmin"
$env:MINIO_BUCKET    = "crisis-reports"
$env:MINIO_USE_SSL   = "false"
$env:MINIO_PUBLIC_URL = "http://localhost:9000"
$env:DASHBOARD_API_KEY = "rapida-dev-key-2026"
$env:GROQ_API_KEY    = (Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match '^GROQ_API_KEY=' } | ForEach-Object { $_.Split('=',2)[1] })
$env:NODE_ENV        = "development"
$env:PORT            = "3001"

Write-Host "Starting backend on :3001..." -ForegroundColor Green
$backend = Start-Process -FilePath "node" -ArgumentList "src/app.js" -WorkingDirectory "backend" -PassThru -NoNewWindow

Write-Host "Starting frontend on :5173..." -ForegroundColor Green
$frontend = Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "frontend" -PassThru -NoNewWindow

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  App:       http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:5173/dashboard" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:3001/api/v1/health" -ForegroundColor Cyan
Write-Host "  Key:       rapida-dev-key-2026" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

try {
    Wait-Process -Id $backend.Id
} finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    docker compose stop postgres minio
}
