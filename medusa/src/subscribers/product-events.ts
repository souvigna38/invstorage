// =============================================================================
// Medusa Subscriber — Product Events → n8n Webhook
// =============================================================================
// Listens for product.created and product.updated events in Medusa and
// forwards them to n8n for automated channel distribution (eBay, Craigslist,
// Facebook Marketplace, etc.).
//
// Non-blocking: if n8n is unreachable, the event is logged but Medusa
// continues normally.
// =============================================================================

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "http://n8n:5678"

// Fan-out: fire to multiple n8n webhooks in parallel
// Each webhook path corresponds to a separate n8n workflow:
//   - Channel distribution (eBay, Craigslist, FB, etc.)
//   - ERPNext shadow sync (Product → Item)
const WEBHOOK_PATHS = [
  "/webhook/medusa-product",         // 01-product-launch-pipeline
  "/webhook/erpnext-product-sync",   // 03-erpnext-product-sync
]

// Cache admin token for internal API calls
let adminToken: string | null = null
let tokenExpiry = 0

async function getMedusaToken(): Promise<string | null> {
  if (adminToken && Date.now() < tokenExpiry) return adminToken
  try {
    const resp = await fetch("http://localhost:9000/auth/user/emailpass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@invstorage.local",
        password: "invtrack123",
      }),
    })
    if (resp.ok) {
      const data = await resp.json()
      adminToken = data.token
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000
      return adminToken
    }
  } catch { /* ignore */ }
  return null
}

export default async function productEventHandler({
  event,
}: SubscriberArgs<{ id: string }>) {
  const { data, name } = event
  const productId = data.id

  try {
    // ── Fetch full product data via Medusa Admin API ─────────────────────
    // Using the Admin REST API instead of internal module service for
    // reliability (module resolution can fail in subscriber context).
    let productData: Record<string, unknown> = { id: productId }

    try {
      const token = await getMedusaToken()
      if (token) {
        const resp = await fetch(
          `http://localhost:9000/admin/products/${productId}?fields=*variants,*variants.prices,*images`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (resp.ok) {
          const { product } = await resp.json()
          productData = {
            id: product.id,
            title: product.title,
            handle: product.handle,
            description: product.description,
            status: product.status,
            metadata: product.metadata || {},
            variants: product.variants?.map((v: any) => ({
              id: v.id,
              title: v.title,
              sku: v.sku || null,
              prices: v.prices?.map((p: any) => ({
                amount: p.amount,
                currency_code: p.currency_code,
              })),
            })),
            images: product.images?.map((img: any) => ({
              id: img.id,
              url: img.url,
            })),
            created_at: product.created_at,
            updated_at: product.updated_at,
          }
        }
      }
    } catch (apiErr) {
      console.warn(
        `[n8n-subscriber] Could not fetch product data for ${productId}:`,
        (apiErr as Error)?.message || apiErr
      )
    }

    // ── POST to n8n webhook ──────────────────────────────────────────────
    const payload = {
      event: name,
      timestamp: new Date().toISOString(),
      source: "medusa",
      data: productData,
    }

    console.log(`[n8n-subscriber] Sending ${name} (product: ${productId}) to ${WEBHOOK_PATHS.length} webhook(s)...`)

    // Fire to all webhook paths in parallel (fan-out)
    const payloadJson = JSON.stringify(payload)
    const results = await Promise.allSettled(
      WEBHOOK_PATHS.map(async (path) => {
        const response = await fetch(`${N8N_WEBHOOK_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
          signal: AbortSignal.timeout(10_000),
        })
        return { path, status: response.status, ok: response.ok }
      })
    )

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { path, status, ok } = result.value
        if (ok) {
          console.log(`[n8n-subscriber] ✓ ${name} → ${path} (HTTP ${status})`)
        } else {
          console.warn(`[n8n-subscriber] ${path} returned HTTP ${status}`)
        }
      } else {
        console.warn(`[n8n-subscriber] Webhook failed:`, result.reason?.message || result.reason)
      }
    }
  } catch (err: unknown) {
    // ── Non-blocking error handling ──────────────────────────────────────
    // Never crash Medusa because n8n is unreachable or slow.
    const error = err as any
    const isConnectionRefused =
      error?.cause?.code === "ECONNREFUSED" ||
      error?.cause?.code === "ENOTFOUND" ||
      error?.name === "AbortError"

    if (isConnectionRefused) {
      console.warn(
        `[n8n-subscriber] n8n not reachable — skipping ${name} event. ` +
        `Is the n8n container running? (URL: ${N8N_WEBHOOK_URL})`
      )
    } else {
      console.warn(
        `[n8n-subscriber] Failed to send ${name} to n8n:`,
        error?.message || error
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
