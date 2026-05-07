#!/bin/sh
set -e

echo "=== Medusa Sales Backend ==="
echo "[1/3] Running database migrations..."
npx medusa db:migrate 2>&1 || echo "  (Migrations may have already run)"

echo "[2/3] Creating admin user (if not exists)..."
npx medusa user -e admin@invstorage.local -p invtrack123 2>/dev/null || echo "  Admin user already exists"

echo "[3/3] Starting Medusa development server..."
npx medusa develop
