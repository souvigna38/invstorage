// =============================================================================
// Medusa Subscriber — Order Events → n8n Webhook
// =============================================================================
// Listens for order.placed events and forwards them to n8n for:
//   - Cross-platform inventory sync (mark as sold on eBay, etc.)
//   - ERPNext shadow ledger (Sales Invoice creation)
//   - Notification workflows (email, SMS)
//   - Automatic listing removal from other channels
//
// Non-blocking: if n8n is unreachable, Medusa continues normally.
// =============================================================================

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "http://n8n:5678"

// Fan-out: fire to multiple n8n webhooks in parallel
const WEBHOOK_PATHS = [
  "/webhook/medusa-order",          // 02-inventory-sync-pipeline
  "/webhook/erpnext-order-sync",    // 04-erpnext-order-sync
]

export default async function orderEventHandler({
  event,
}: SubscriberArgs<{ id: string }>) {
  const { data, name } = event
  const orderId = data.id

  try {
    // ── POST order event to n8n ──────────────────────────────────────────
    const payload = {
      event: name,
      timestamp: new Date().toISOString(),
      source: "medusa",
      data: {
        id: orderId,
        // n8n can call back to Medusa Admin API for full order details:
        //   GET /admin/orders/{id}
        // This keeps the subscriber lightweight.
      },
    }

    console.log(`[n8n-subscriber] Sending ${name} (order: ${orderId}) to ${WEBHOOK_PATHS.length} webhook(s)...`)

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
  event: ["order.placed"],
}
