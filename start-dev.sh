#!/usr/bin/env bash
# ============================================================
# RAPIDA — Start dev environment (hot reload)
# Runs backend + frontend natively; uses Docker for DB + MinIO
# ============================================================

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}Starting RAPIDA in dev mode...${NC}"

# Ensure DB and MinIO are running
docker compose up -d postgres minio 2>/dev/null

# Wait for postgres
echo -n "Waiting for database"
for i in $(seq 1 20); do
  if nc -zq 1 localhost 5432 2>/dev/null || nc -z localhost 5432 2>/dev/null; then
    echo -e " ${GREEN}✓${NC}"; break
  fi
  echo -n "."; sleep 1
done

# Kill any previous dev processes on these ports
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
fuser -k 5174/tcp 2>/dev/null || true

echo -e "${GREEN}✓ Starting backend on :3001${NC}"
cd backend
DATABASE_URL="postgresql://crisis_user:changeme@localhost:5432/crisis_mapper" \
MINIO_ENDPOINT=localhost \
MINIO_PORT=9000 \
MINIO_ACCESS_KEY=minioadmin \
MINIO_SECRET_KEY=minioadmin \
MINIO_BUCKET=crisis-reports \
MINIO_USE_SSL=false \
MINIO_PUBLIC_URL=http://localhost:9000 \
DASHBOARD_API_KEY=rapida-dev-key-2026 \
GROQ_API_KEY=$(grep '^GROQ_API_KEY=' .env 2>/dev/null | cut -d= -f2) \
NODE_ENV=development \
PORT=3001 \
node src/app.js &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✓ Starting frontend on :5173${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}══════════════════════════════════${NC}"
echo -e "  App:       ${CYAN}http://localhost:5173${NC}"
echo -e "  Dashboard: ${CYAN}http://localhost:5173/dashboard${NC}"
echo -e "  API:       ${CYAN}http://localhost:3001/api/v1/health${NC}"
echo -e "  Key:       ${CYAN}rapida-dev-key-2026${NC}"
echo -e "${GREEN}══════════════════════════════════${NC}"
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# Stop both processes on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose stop postgres minio; exit 0" INT TERM

wait
