#!/usr/bin/env bash
set -euo pipefail

echo "=== [InvStorage] Starting Cloud Agent Services ==="

# 1. Start PostgreSQL if not already running
if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  sudo service postgresql start
fi

# 2. Start Redis if not already running
if ! redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; then
  sudo service redis-server start
fi

# Wait for PostgreSQL to accept connections
until pg_isready -h localhost -p 5432 -q; do
  sleep 1
done

# Ensure database exists and has vector extension
sudo -u postgres psql -c "CREATE USER admin WITH SUPERUSER PASSWORD 'secure_password';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE inventory OWNER admin;" 2>/dev/null || true
sudo -u postgres psql -d inventory -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

ITEM_COUNT=$(PGPASSWORD=secure_password psql -U admin -h localhost -d inventory -t -c "SELECT count(*) FROM items;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$ITEM_COUNT" -eq 0 ]; then
  echo "Restoring database from dump..."
  PGPASSWORD=secure_password psql -U admin -h localhost -d inventory < /workspace/data/inventory_dump.sql >/dev/null 2>&1 || true
fi

# 3. Launch Next.js inventory application in foreground
cd /workspace/frontend

export DATABASE_URL="postgresql://admin:secure_password@localhost:5432/inventory?schema=public"
export REDIS_URL="redis://localhost:6379"
export VISION_PROVIDER="auto"
export CLIP_PROVIDER="auto"
export NODE_ENV="production"

echo "InvStorage ready! Starting Next.js app on port 3000..."
exec npm run start -- -p 3000 -H 0.0.0.0
