// =============================================================================
// Centralized service URLs — eliminates hardcoded localhost references
// =============================================================================
// Uses NEXT_PUBLIC_* env vars so they're available in both server and client.
// Falls back to localhost defaults for development convenience.
// =============================================================================

export const SERVICE_URLS = {
  medusa: process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9500",
  n8n: process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678",
  erpnext: process.env.NEXT_PUBLIC_ERPNEXT_URL || "http://localhost:8090",
  openclaw: process.env.NEXT_PUBLIC_OPENCLAW_URL || "http://localhost:18789",
  adminer: process.env.NEXT_PUBLIC_ADMINER_URL || "http://localhost:8080",
  nocodb: process.env.NEXT_PUBLIC_NOCODB_URL || "http://localhost:8086",
  minio: process.env.NEXT_PUBLIC_MINIO_ENDPOINT || "http://localhost:9000",
} as const;

/** Medusa admin dashboard URL */
export const MEDUSA_ADMIN_URL = `${SERVICE_URLS.medusa}/app`;
