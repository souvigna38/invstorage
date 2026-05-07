# =============================================================================
# InvStorage Frontend — Production Dockerfile
# =============================================================================
# Full Next.js production build + scripts (ingest, label, msrp, group).
# Includes tsx for running TypeScript scripts directly.
#
# Build:   docker build -t invstorage-frontend .
# Run:     docker run -p 3000:3000 --env-file .env.docker invstorage-frontend
# Scripts: docker exec <container> npx tsx src/scripts/ingest-photos.ts
# =============================================================================

FROM node:22-alpine

# Install system dependencies:
#   - libc6-compat, openssl: Node.js native module support
#   - curl: healthcheck
#   - libheif: HEIC → JPEG conversion (replaces macOS sips)
RUN apk add --no-cache libc6-compat openssl curl libheif libheif-tools

WORKDIR /app

# ── Step 1: Install dependencies ──────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm ci

# ── Step 2: Generate Prisma client ────────────────────────────────────────
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# ── Step 3: Copy source code ─────────────────────────────────────────────
COPY . .

# ── Step 4: Build Next.js (NEXT_PUBLIC_* vars baked at build time) ────────
ENV NEXT_TELEMETRY_DISABLED=1
# These are the browser-facing URLs (accessed via Docker published ports)
ARG NEXT_PUBLIC_MINIO_ENDPOINT=http://localhost:9000
ARG NEXT_PUBLIC_MINIO_BUCKET=inventory
ARG NEXT_PUBLIC_HOST_IP=localhost
ENV NEXT_PUBLIC_MINIO_ENDPOINT=$NEXT_PUBLIC_MINIO_ENDPOINT
ENV NEXT_PUBLIC_MINIO_BUCKET=$NEXT_PUBLIC_MINIO_BUCKET
ENV NEXT_PUBLIC_HOST_IP=$NEXT_PUBLIC_HOST_IP

RUN npm run build

# ── Step 5: Production runtime ────────────────────────────────────────────
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]
