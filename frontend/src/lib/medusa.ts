// =============================================================================
// Medusa.js REST API Client — bridges inventory ↔ sales
// =============================================================================
// This module handles authentication and product CRUD against the Medusa
// backend running inside Docker at MEDUSA_BACKEND_URL.
// =============================================================================

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "";
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || "";

// Cache the auth token in memory (server-side only)
let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Authenticate with Medusa Admin API and return a JWT token.
 */
async function getAdminToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const resp = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Medusa auth failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  cachedToken = data.token;
  // Tokens typically last 24h; refresh after 23h
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

/**
 * Make an authenticated request to the Medusa Admin API.
 */
async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAdminToken();
  return fetch(`${MEDUSA_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// =============================================================================
// Product Operations
// =============================================================================

export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  variants?: { id: string; prices?: { amount: number; currency_code: string }[] }[];
}

/**
 * Create a product in Medusa from an inventory item.
 * Returns the Medusa product ID.
 *
 * @param channels - Optional array of sales channels to distribute to via n8n
 *                   e.g. ['ebay', 'craigslist', 'amazon', 'facebook']
 *                   Stored in Medusa product metadata for n8n to read.
 */
export async function createProduct(params: {
  title: string;
  description: string;
  price: number; // in dollars (will convert to cents)
  imageUrl?: string | null;
  inventoryItemId: number;
  channels?: string[]; // Sales channels for n8n distribution
  sku?: string; // SKU for ERPNext sync — must be unique per variant
}): Promise<{ product: MedusaProduct }> {
  // First, get the default sales channel
  const scResp = await adminFetch("/admin/sales-channels?limit=1");
  let salesChannelId: string | null = null;

  if (scResp.ok) {
    const scData = await scResp.json();
    if (scData.sales_channels && scData.sales_channels.length > 0) {
      salesChannelId = scData.sales_channels[0].id;
    }
  }

  // Build the product payload
  // Medusa v2 requires options when creating variants
  const payload: Record<string, unknown> = {
    title: params.title,
    description: params.description || "",
    status: "published",
    metadata: {
      inventory_item_id: params.inventoryItemId,
      source: "personal-inventory-docker",
      // Sales channels for n8n workflow routing (eBay, Craigslist, etc.)
      channels: params.channels || [],
    },
    options: [
      {
        title: "Type",
        values: ["Default"],
      },
    ],
    variants: [
      {
        title: "Default",
        sku: params.sku || `INVT-${params.inventoryItemId}`,
        options: { Type: "Default" },
        prices: [
          {
            amount: Math.round(params.price * 100), // Medusa uses cents
            currency_code: "usd",
          },
        ],
        manage_inventory: false,
      },
    ],
  };

  // Add images if available
  if (params.imageUrl) {
    payload.images = [{ url: params.imageUrl }];
  }

  // Add sales channel if available
  if (salesChannelId) {
    payload.sales_channels = [{ id: salesChannelId }];
  }

  const resp = await adminFetch("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to create Medusa product (${resp.status}): ${errText}`);
  }

  return resp.json();
}

/**
 * Update a Medusa product's price or details.
 */
export async function updateProduct(
  medusaProductId: string,
  updates: {
    title?: string;
    description?: string;
    price?: number;
    status?: "draft" | "published" | "rejected";
  }
): Promise<{ product: MedusaProduct }> {
  const payload: Record<string, unknown> = {};

  if (updates.title) payload.title = updates.title;
  if (updates.description) payload.description = updates.description;
  if (updates.status) payload.status = updates.status;

  const resp = await adminFetch(`/admin/products/${medusaProductId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to update Medusa product (${resp.status}): ${errText}`);
  }

  // If price changed, update the variant price
  if (updates.price != null) {
    const productData = await resp.json();
    const variant = productData.product?.variants?.[0];
    if (variant) {
      await adminFetch(`/admin/products/${medusaProductId}/variants/${variant.id}`, {
        method: "POST",
        body: JSON.stringify({
          prices: [{ amount: Math.round(updates.price * 100), currency_code: "usd" }],
        }),
      });
    }
    return productData;
  }

  return resp.json();
}

/**
 * Delete (unpublish) a product from Medusa.
 */
export async function deleteProduct(medusaProductId: string): Promise<void> {
  const resp = await adminFetch(`/admin/products/${medusaProductId}`, {
    method: "DELETE",
  });

  if (!resp.ok && resp.status !== 404) {
    const errText = await resp.text();
    throw new Error(`Failed to delete Medusa product (${resp.status}): ${errText}`);
  }
}

/**
 * Get a product from Medusa by ID.
 */
export async function getProduct(
  medusaProductId: string
): Promise<MedusaProduct | null> {
  const resp = await adminFetch(`/admin/products/${medusaProductId}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.product || null;
}

/**
 * List all products in Medusa (for the sales dashboard).
 */
export async function listProducts(
  limit = 50,
  offset = 0
): Promise<{ products: MedusaProduct[]; count: number }> {
  const resp = await adminFetch(
    `/admin/products?limit=${limit}&offset=${offset}&order=-created_at`
  );

  if (!resp.ok) {
    return { products: [], count: 0 };
  }

  return resp.json();
}

/**
 * List orders from Medusa.
 */
export async function listOrders(
  limit = 50,
  offset = 0
): Promise<{ orders: unknown[]; count: number }> {
  const resp = await adminFetch(
    `/admin/orders?limit=${limit}&offset=${offset}&order=-created_at`
  );

  if (!resp.ok) {
    return { orders: [], count: 0 };
  }

  return resp.json();
}

/**
 * Check if Medusa is healthy and reachable.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${MEDUSA_URL}/health`, { method: "GET" });
    return resp.ok;
  } catch {
    return false;
  }
}
