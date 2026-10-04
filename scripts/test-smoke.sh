#!/usr/bin/env bash
# =============================================================================
# InvStorage — Cloud & Local End-to-End Smoke Test
# =============================================================================
# Verifies database, cache, vision mock, security regressions, build, and API.
# Usage: bash scripts/test-smoke.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "==========================================="
echo " InvStorage Cloud Smoke Test"
echo "==========================================="

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  ✓ PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  ✗ FAIL: $1"; }

# 1. Database check
echo ""
echo "[Step 1] PostgreSQL Database & pgvector"
echo "---"
if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  pass "PostgreSQL is reachable on port 5432"
else
  fail "PostgreSQL is not reachable on port 5432"
fi

ITEM_COUNT=$(PGPASSWORD=secure_password psql -U admin -h localhost -d inventory -t -c "SELECT count(*) FROM items;" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$ITEM_COUNT" -ge 20 ]; then
  pass "Inventory items loaded ($ITEM_COUNT items present)"
else
  fail "Expected at least 20 items in inventory, found: $ITEM_COUNT"
fi

VECTOR_EXT=$(PGPASSWORD=secure_password psql -U admin -h localhost -d inventory -t -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" 2>/dev/null | tr -d ' ' || echo "")
if [ "$VECTOR_EXT" = "vector" ]; then
  pass "pgvector extension is installed and enabled"
else
  fail "pgvector extension is missing"
fi

# 2. Redis check
echo ""
echo "[Step 2] Redis Cache & Queue Broker"
echo "---"
REDIS_PONG=$(redis-cli -h localhost -p 6379 ping 2>/dev/null || echo "")
if [ "$REDIS_PONG" = "PONG" ]; then
  pass "Redis is reachable and responded PONG"
else
  fail "Redis is not reachable on port 6379"
fi

# 3. Unit and Security regression tests
echo ""
echo "[Step 3] Sanitization & Security Regression Tests"
echo "---"
if node scripts/test-sanitize.mjs > /dev/null 2>&1; then
  pass "Sanitizer unit tests passed (35 tests)"
else
  fail "Sanitizer unit tests failed"
fi

if bash scripts/test-security.sh > /dev/null 2>&1; then
  pass "Security regression tests passed (22 tests)"
else
  fail "Security regression tests failed"
fi

# 4. Pluggable Vision Client Tests
echo ""
echo "[Step 4] Pluggable Vision Client & Mock Fixtures"
echo "---"
if node scripts/test-vision.mjs > /dev/null 2>&1; then
  pass "Vision client mock fixtures & embedding tests passed (21 tests)"
else
  fail "Vision client tests failed"
fi

# 5. Build and API test
echo ""
echo "[Step 5] Next.js App Startup & API Verification"
echo "---"

cd "$ROOT_DIR/frontend"

# Build check
if [ ! -d ".next" ]; then
  echo "  Building Next.js app..."
  DATABASE_URL="postgresql://admin:secure_password@localhost:5432/inventory?schema=public" npm run build > /dev/null 2>&1
fi

if [ -d ".next" ]; then
  pass "Next.js production build exists"
else
  fail "Next.js build missing"
fi

# Start server in background for smoke check
PORT=3099
DATABASE_URL="postgresql://admin:secure_password@localhost:5432/inventory?schema=public" \
REDIS_URL="redis://localhost:6379" \
VISION_PROVIDER="mock" \
npx next start -p $PORT > /tmp/nextjs-smoke.log 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Wait for server ready
SERVER_READY=0
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null | grep -q "200"; then
    SERVER_READY=1
    break
  fi
  sleep 0.5
done

if [ "$SERVER_READY" -eq 1 ]; then
  pass "Next.js server started and responded HTTP 200 on /"
else
  fail "Next.js server did not start within 15 seconds"
fi

# Test Locate API (JSON)
LOCATE_CODE=$(curl -s -o /tmp/locate.json -w "%{http_code}" "http://localhost:$PORT/api/locate?q=MacBook" 2>/dev/null || echo "000")
if [ "$LOCATE_CODE" = "200" ] && grep -q '"found":true' /tmp/locate.json; then
  pass "Fast Locate API (/api/locate?q=MacBook) returned match"
else
  fail "Locate API failed (HTTP $LOCATE_CODE)"
fi

# Test Locate API (Plain text for Siri / Apple Shortcuts)
TEXT_RESP=$(curl -s -H "Accept: text/plain" "http://localhost:$PORT/api/locate?q=MacBook" 2>/dev/null || echo "")
if [[ "$TEXT_RESP" == *"MacBook"* ]]; then
  pass "Locate API plain text voice mode works for Apple Shortcuts"
else
  fail "Locate API plain text voice mode failed: $TEXT_RESP"
fi

# Test Sales Status API
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/sales/status" 2>/dev/null || echo "000")
if [ "$STATUS_CODE" = "200" ]; then
  pass "Sales status API (/api/sales/status) responded HTTP 200"
else
  fail "Sales status API failed (HTTP $STATUS_CODE)"
fi

cleanup
trap - EXIT

# Summary
echo ""
echo "==========================================="
echo " Smoke Test Summary: $PASS passed, $FAIL failed (of $TOTAL)"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo " All smoke tests passed successfully!"
exit 0
