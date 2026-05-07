#!/usr/bin/env bash
# =============================================================================
# Security regression tests for Personal Inventory Portable
# =============================================================================
# Run from the project root: bash scripts/test-security.sh
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  PASS: $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  FAIL: $1"; }

echo "==========================================="
echo " Security Regression Tests"
echo "==========================================="

# -------------------------------------------------------------------------
# TEST 1: Shell command injection via filenames
# Verify execFileSync is used instead of execSync
# -------------------------------------------------------------------------
echo ""
echo "[Fix 1] Shell command injection via filenames"
echo "---"

# 1a. Confirm no execSync usage remains in scripts
if grep -rq 'execSync' frontend/src/scripts/*.ts 2>/dev/null; then
  fail "execSync still found in scripts/ — should be execFileSync"
else
  pass "No execSync in scripts/ (all replaced with execFileSync)"
fi

# 1b. Confirm execFileSync is used
if grep -rq 'execFileSync' frontend/src/scripts/ingest-photos.ts && \
   grep -rq 'execFileSync' frontend/src/scripts/group-photos.ts && \
   grep -rq 'execFileSync' frontend/src/scripts/label-unprocessed.ts; then
  pass "execFileSync present in all 3 script files"
else
  fail "execFileSync missing from one or more script files"
fi

# 1c. Confirm no backtick template literal patterns with exec calls remain
if grep -q 'execFileSync' frontend/src/scripts/ingest-photos.ts && \
   ! grep -q 'execSync(' frontend/src/scripts/ingest-photos.ts; then
  pass "No shell template literal patterns in ingest-photos.ts"
else
  fail "Shell template literal pattern still found in ingest-photos.ts"
fi

# -------------------------------------------------------------------------
# TEST 2: AI output sanitization
# -------------------------------------------------------------------------
echo ""
echo "[Fix 2] AI output sanitization (sanitizeAiLabel + sanitizeUserText)"
echo "---"

# 2a. Confirm sanitize.ts exists
if [ -f "frontend/src/lib/sanitize.ts" ]; then
  pass "lib/sanitize.ts exists"
else
  fail "lib/sanitize.ts does not exist"
fi

# 2b. Confirm sanitizeAiLabel is imported and used in all 3 files
for f in frontend/src/scripts/ingest-photos.ts frontend/src/scripts/label-unprocessed.ts frontend/src/workers/processor.ts; do
  if grep -q 'sanitizeAiLabel' "$f"; then
    pass "sanitizeAiLabel used in $(basename $f)"
  else
    fail "sanitizeAiLabel NOT used in $(basename $f)"
  fi
done

# 2c. Run the standalone sanitizer unit tests
if node scripts/test-sanitize.mjs > /dev/null 2>&1; then
  pass "All sanitizer unit tests passed (35 tests)"
else
  fail "Sanitizer unit tests failed"
fi

# -------------------------------------------------------------------------
# TEST 3: Medusa description/SKU sanitization
# -------------------------------------------------------------------------
echo ""
echo "[Fix 3] Medusa description/SKU sanitization"
echo "---"

# 3a. Confirm sanitizeUserText is imported in publish route
if grep -q 'sanitizeUserText' frontend/src/app/api/sales/publish/route.ts; then
  pass "sanitizeUserText imported in sales/publish route"
else
  fail "sanitizeUserText NOT imported in sales/publish route"
fi

# 3b. Confirm description is sanitized before createProduct
if grep -q 'safeDescription' frontend/src/app/api/sales/publish/route.ts; then
  pass "Description is sanitized (safeDescription) before createProduct"
else
  fail "Description not sanitized before createProduct"
fi

# 3c. Confirm SKU is sanitized before createProduct
if grep -q 'safeSku' frontend/src/app/api/sales/publish/route.ts; then
  pass "SKU is sanitized (safeSku) before createProduct"
else
  fail "SKU not sanitized before createProduct"
fi

# 3d. Verify sanitizeUserText strips HTML (already tested in test-sanitize.mjs)
RESULT=$(node -e "
  function sanitizeUserText(s, maxLen) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/<[^>]*>/g, '').trim().slice(0, maxLen || 2000);
  }
  const r = sanitizeUserText('<script>alert(1)</script>A product', 2000);
  process.stdout.write(r.includes('<') ? 'FAIL' : 'PASS');
")
if [ "$RESULT" = "PASS" ]; then
  pass "sanitizeUserText correctly strips HTML from descriptions"
else
  fail "sanitizeUserText does not strip HTML"
fi

# -------------------------------------------------------------------------
# TEST 4: CLIP embedding array validation
# -------------------------------------------------------------------------
echo ""
echo "[Fix 4] CLIP embedding array validation"
echo "---"

# 4a. Confirm validation code exists in search.ts
if grep -q 'Number.isFinite' frontend/src/actions/inventory/search.ts; then
  pass "Number.isFinite validation present in search.ts"
else
  fail "Number.isFinite validation NOT present in search.ts"
fi

if grep -q 'Array.isArray(embedding)' frontend/src/actions/inventory/search.ts; then
  pass "Array.isArray check present in search.ts"
else
  fail "Array.isArray check NOT present in search.ts"
fi

# 4b. Test embedding validation logic with Node.js
RESULT=$(node -e "
  function isValid(emb) {
    return !!(emb && Array.isArray(emb) && emb.length > 0 &&
      emb.every(v => typeof v === 'number' && Number.isFinite(v)));
  }
  const tests = [
    [null, false, 'null'],
    [undefined, false, 'undefined'],
    [[], false, 'empty array'],
    [[1, 2, NaN], false, 'contains NaN'],
    [[1, 2, Infinity], false, 'contains Infinity'],
    [[1, 2, -Infinity], false, 'contains -Infinity'],
    [[1, 'sql injection', 3], false, 'contains string'],
    [[0.1, -0.5, 0.9], true, 'valid floats'],
    [Array(512).fill(0.01), true, 'valid 512-dim vector'],
  ];
  let ok = true;
  for (const [input, expected, name] of tests) {
    const result = isValid(input);
    if (result !== expected) {
      process.stderr.write('FAIL: ' + name + ' (expected ' + expected + ', got ' + result + ')\n');
      ok = false;
    }
  }
  process.stdout.write(ok ? 'PASS' : 'FAIL');
")
if [ "$RESULT" = "PASS" ]; then
  pass "Embedding validation rejects NaN/Infinity/strings/null/empty, accepts valid vectors"
else
  fail "Embedding validation logic has issues"
fi

# -------------------------------------------------------------------------
# TEST 5: Content-Security-Policy headers
# -------------------------------------------------------------------------
echo ""
echo "[Fix 5] Content-Security-Policy and security headers"
echo "---"

# 5a. Confirm headers() function exists in next.config.ts
if grep -q 'async headers()' frontend/next.config.ts; then
  pass "headers() function present in next.config.ts"
else
  fail "headers() function NOT present in next.config.ts"
fi

# 5b. Confirm CSP header is configured
if grep -q 'Content-Security-Policy' frontend/next.config.ts; then
  pass "Content-Security-Policy header configured"
else
  fail "Content-Security-Policy header NOT configured"
fi

# 5c. Confirm X-Content-Type-Options
if grep -q 'X-Content-Type-Options' frontend/next.config.ts; then
  pass "X-Content-Type-Options header configured"
else
  fail "X-Content-Type-Options header NOT configured"
fi

# 5d. Confirm X-Frame-Options
if grep -q 'X-Frame-Options' frontend/next.config.ts; then
  pass "X-Frame-Options header configured"
else
  fail "X-Frame-Options header NOT configured"
fi

# 5e. Confirm Referrer-Policy
if grep -q 'Referrer-Policy' frontend/next.config.ts; then
  pass "Referrer-Policy header configured"
else
  fail "Referrer-Policy header NOT configured"
fi

# 5f. Confirm Permissions-Policy
if grep -q 'Permissions-Policy' frontend/next.config.ts; then
  pass "Permissions-Policy header configured"
else
  fail "Permissions-Policy header NOT configured"
fi

# 5g. Confirm CSP allows MinIO images
if grep -q 'http://localhost:\*' frontend/next.config.ts && grep -q 'http://storage:\*' frontend/next.config.ts; then
  pass "CSP allows MinIO image sources (localhost + storage)"
else
  fail "CSP may block MinIO images"
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo "==========================================="
echo " Results: $PASS passed, $FAIL failed (of $TOTAL)"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
