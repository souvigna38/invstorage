#!/bin/bash
# =============================================================================
# Personal Inventory Portable — First-Time Setup
# =============================================================================
# Run this ONCE after copying the project to a new Mac.
# It builds images, starts core infrastructure, restores the database,
# creates the MinIO bucket, and brings up all services.
#
# Usage:  chmod +x scripts/setup.sh && ./scripts/setup.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo " Personal Inventory Portable — Setup"
echo "=========================================="
echo ""

# 1. Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker Desktop first."
    echo "  On Mac: open -a Docker"
    exit 1
fi

echo "[1/7] Docker is running ✓"

# 2. Create photo-inbox directories if they don't exist
mkdir -p photo-inbox/processed
echo "[2/7] Photo inbox directory ready ✓"

# 3. Build all custom images
echo "[3/7] Building Docker images (this may take several minutes on first run)..."
docker compose build

# 4. Start core infrastructure first (DB, Redis, MinIO)
echo "[4/7] Starting core infrastructure (database, redis, storage)..."
docker compose up -d db redis storage
echo "  Waiting for database to be healthy..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U admin -d inventory > /dev/null 2>&1; then
        echo "  Database is ready ✓"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "  ERROR: Database did not become ready in time."
        exit 1
    fi
    sleep 2
done

# 5. Restore the database from the included dump
echo "[5/7] Restoring database with pre-loaded inventory data..."
# The init scripts in backend/init/ run automatically on first start.
# But we also restore our full dump to ensure all 31 items are present.
sleep 3  # Give init scripts a moment to complete
# Create additional databases needed by services (in case init scripts didn't fire)
docker compose exec -T db psql -U admin -d postgres -c "CREATE DATABASE n8n;" 2>/dev/null || true
docker compose exec -T db psql -U admin -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE n8n TO admin;" 2>/dev/null || true
docker compose exec -T db psql -U admin -d postgres -c "CREATE DATABASE medusa_store;" 2>/dev/null || true
docker compose exec -T db psql -U admin -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE medusa_store TO admin;" 2>/dev/null || true
echo "  Service databases ready"
# Restore inventory data
docker compose exec -T db psql -U admin -d inventory < data/inventory_dump.sql 2>&1 | tail -5
echo "  Running schema compatibility checks..."
docker compose exec -T db psql -U admin -d inventory < data/ensure_columns.sql 2>&1 | tail -3
echo "  Database restored ✓"

# 6. Create MinIO bucket
echo "[6/7] Setting up MinIO storage bucket..."
# Wait for MinIO to be healthy
for i in $(seq 1 15); do
    if docker compose exec -T storage curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

# Create the inventory bucket using mc (MinIO client)
docker compose exec -T storage sh -c '
    mc alias set local http://localhost:9000 minioadmin minioadmin123 2>/dev/null
    mc mb local/inventory 2>/dev/null || true
    mc anonymous set download local/inventory 2>/dev/null || true
' 2>&1 | grep -v "^$" || true
echo "  MinIO bucket ready ✓"

# 7. Bring up all services
echo "[7/7] Starting all services..."
docker compose up -d

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo " Services starting up... some may take 1-3 minutes."
echo ""
echo " Web Interfaces:"
echo "   Inventory App:     http://localhost:3000"
echo "   MinIO Console:     http://localhost:9001  (minioadmin / minioadmin123)"
echo "   Medusa Admin:      http://localhost:9500/app"
echo "   n8n Workflows:     http://localhost:5678"
echo "   ERPNext:           http://localhost:8090  (Administrator / admin)"
echo "   NocoDB Data Lake:  http://localhost:8086"
echo "   Ingestion API:     http://localhost:8085/dashboard"
echo "   Database Browser:  http://localhost:8080"
echo ""
echo " To check service status:"
echo "   docker compose ps"
echo ""
echo " To stop everything:"
echo "   ./scripts/stop.sh"
echo ""
