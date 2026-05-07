# =============================================================================
# InvStorage Medusa Sales Backend — Dockerfile (Lightweight)
# =============================================================================
# Medusa.js v2 backend for sales management.
# Runs in development mode for faster startup and smaller image.
# Admin dashboard available at /app after startup.
#
# Admin:   http://localhost:9500/app (admin@invstorage.local / invtrack123)
# =============================================================================

FROM node:22-alpine

# System dependencies
RUN apk add --no-cache curl

WORKDIR /server

# ── Step 1: Install dependencies ──────────────────────────────────────────
COPY package.json ./
RUN npm install --legacy-peer-deps 2>/dev/null || npm install

# ── Step 2: Copy source + config ─────────────────────────────────────────
COPY . .

# ── Step 3: Make startup script executable ────────────────────────────────
RUN chmod +x start.sh

EXPOSE 9000

HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=120s \
  CMD curl -f http://localhost:9000/health || exit 1

ENTRYPOINT ["./start.sh"]
