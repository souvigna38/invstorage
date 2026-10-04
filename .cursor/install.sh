#!/usr/bin/env bash
set -euo pipefail

echo "=== [InvStorage] Cloud Agent Install ==="

# 1. Install system packages if missing
if ! command -v psql >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  echo "Installing system packages (PostgreSQL 16, pgvector, Redis, libheif)..."
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql postgresql-contrib postgresql-16-pgvector \
    redis-server libheif-examples
fi

# 2. Start PostgreSQL and Redis temporarily to initialize database and load seed data
sudo service postgresql start
sudo service redis-server start

until pg_isready -h localhost -p 5432 -q; do
  sleep 1
done

# 3. Create database user and databases if they don't exist
sudo -u postgres psql -c "CREATE USER admin WITH SUPERUSER PASSWORD 'secure_password';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE inventory OWNER admin;" 2>/dev/null || true
sudo -u postgres psql -d inventory -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE medusa_store OWNER admin;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE n8n OWNER admin;" 2>/dev/null || true

# 4. Restore inventory schema and seed data if table is empty
ITEM_COUNT=$(PGPASSWORD=secure_password psql -U admin -h localhost -d inventory -t -c "SELECT count(*) FROM items;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$ITEM_COUNT" -eq 0 ]; then
  echo "Loading initial inventory data into PostgreSQL..."
  PGPASSWORD=secure_password psql -U admin -h localhost -d inventory < /workspace/data/inventory_dump.sql >/dev/null 2>&1 || true
fi

# 5. Frontend dependencies & Next.js build
cd /workspace/frontend
npm install
npx prisma generate
DATABASE_URL="postgresql://admin:secure_password@localhost:5432/inventory?schema=public" npm run build

echo "=== [InvStorage] Cloud Agent Install Completed Successfully ==="
