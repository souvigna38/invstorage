// =============================================================================
// GET /api/sales/status — Get Medusa + n8n + ERPNext + OpenClaw service status
// =============================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkHealth, listProducts, listOrders } from "@/lib/medusa";
import { requireAuth } from "@/lib/auth";
import { SERVICE_URLS, MEDUSA_ADMIN_URL } from "@/lib/config";

async function checkN8nHealth(): Promise<boolean> {
  try {
    const resp = await fetch("http://n8n:5678/healthz", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    // Fall back to checking if the root page responds
    try {
      const resp = await fetch("http://n8n:5678/", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return resp.ok || resp.status === 401; // 401 means n8n is up but needs auth
    } catch {
      return false;
    }
  }
}

async function checkERPNextHealth(): Promise<boolean> {
  try {
    // ERPNext backend serves on port 8000 inside Docker network
    const resp = await fetch("http://erpnext-backend:8000/api/method/frappe.handler.version", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function checkOpenClawHealth(): Promise<boolean> {
  try {
    // OpenClaw gateway serves on port 18789
    const resp = await fetch("http://openclaw:18789/", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok || resp.status === 401; // 401 = running but needs token
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    // 1. Check Medusa, n8n, ERPNext, and OpenClaw health in parallel
    const [medusaHealthy, n8nHealthy, erpnextHealthy, openclawHealthy] = await Promise.all([
      checkHealth(),
      checkN8nHealth(),
      checkERPNextHealth(),
      checkOpenClawHealth(),
    ]);

    // 2. Count items listed for sale in our inventory
    const listedCount = await prisma.items.count({
      where: { medusa_product_id: { not: null }, deleted_at: null },
    });

    // 3. Count sold items
    const soldCount = await prisma.items.count({
      where: { sold_price: { not: null }, deleted_at: null },
    });

    // 4. If Medusa is healthy, get product and order counts
    let medusaProducts = 0;
    let medusaOrders = 0;
    if (medusaHealthy) {
      try {
        const products = await listProducts(1, 0);
        medusaProducts = products.count || 0;
        const orders = await listOrders(1, 0);
        medusaOrders = orders.count || 0;
      } catch {
        // Medusa might be healthy but not fully initialized
      }
    }

    return NextResponse.json({
      success: true,
      medusa_healthy: medusaHealthy,
      n8n_healthy: n8nHealthy,
      erpnext_healthy: erpnextHealthy,
      openclaw_healthy: openclawHealthy,
      medusa_admin_url: MEDUSA_ADMIN_URL,
      n8n_dashboard_url: SERVICE_URLS.n8n,
      erpnext_dashboard_url: SERVICE_URLS.erpnext,
      openclaw_dashboard_url: SERVICE_URLS.openclaw,
      listed_items: listedCount,
      sold_items: soldCount,
      medusa_products: medusaProducts,
      medusa_orders: medusaOrders,
    });
  } catch (err) {
    console.error("[sales/status] Error:", err);
    return NextResponse.json(
      { success: false, error: "Status check failed" },
      { status: 500 }
    );
  }
}
