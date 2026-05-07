// =============================================================================
// POST /api/sales/publish — Publish an inventory item to Medusa for sale
// =============================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProduct, checkHealth } from "@/lib/medusa";
import { requireAuth, ADMIN_USER_ID } from "@/lib/auth";
import { sanitizeUserText } from "@/lib/sanitize";

export async function POST(req: Request) {
  const authErr = requireAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { itemId, price, description, channels, sku } = body;

    if (!itemId || typeof itemId !== "number" || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ success: false, error: "Valid positive integer itemId required" }, { status: 400 });
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return NextResponse.json({ success: false, error: "Price must be a non-negative number" }, { status: 400 });
    }

    // 1. Check Medusa is reachable
    const healthy = await checkHealth();
    if (!healthy) {
      return NextResponse.json(
        { success: false, error: "Medusa sales backend is not reachable. Please check if the medusa service is running." },
        { status: 503 }
      );
    }

    // 2. Fetch the inventory item
    const item = await prisma.items.findUnique({
      where: { id: itemId, deleted_at: null },
      include: { item_images: { orderBy: { display_order: "asc" } } },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    // 3. Check if already published
    if (item.medusa_product_id) {
      return NextResponse.json({
        success: false,
        error: "Item is already listed for sale",
        medusa_product_id: item.medusa_product_id,
      }, { status: 409 });
    }

    // 4. Determine the sale price
    const salePrice = price
      ?? (item.list_price ? Number(item.list_price) : null)
      ?? (item.estimated_value ? Number(item.estimated_value) : null)
      ?? (item.price ? Number(item.price) : 0);

    // 5. Build image URL — use the public MinIO URL
    const imageUrl = item.image_url || item.item_images[0]?.image_url || null;

    // 6. Create product in Medusa (with channel metadata for n8n distribution)
    // SKU is critical for ERPNext sync — it becomes the ERPNext Item Code
    // Sanitize user-supplied text before forwarding to external services
    const safeDescription = sanitizeUserText(description || item.description || "", 2000);
    const safeSku = sanitizeUserText(sku, 50) || item.asset_tag || `INVT-${item.id}`;

    const result = await createProduct({
      title: item.title,
      description: safeDescription,
      price: salePrice,
      imageUrl,
      inventoryItemId: item.id,
      channels: Array.isArray(channels) ? channels : [],
      sku: safeSku,
    });

    const medusaProductId = result.product.id;

    // 7. Update our inventory item with the Medusa product ID and list price
    await prisma.items.update({
      where: { id: itemId },
      data: {
        medusa_product_id: medusaProductId,
        list_price: salePrice,
        updated_at: new Date(),
      },
    });

    // 8. Log the action
    await prisma.action_logs.create({
      data: {
        action_type: "update",
        performed_by: ADMIN_USER_ID,
        item_id: itemId,
        note: `Listed for sale on Medusa at $${salePrice.toFixed(2)} (product: ${medusaProductId}, SKU: ${safeSku})${Array.isArray(channels) && channels.length > 0 ? ` [channels: ${channels.join(", ")}]` : ""}`,
        action_date: new Date(),
      },
    });

    const channelList = Array.isArray(channels) && channels.length > 0
      ? ` → ${channels.join(", ")}`
      : "";

    return NextResponse.json({
      success: true,
      medusa_product_id: medusaProductId,
      price: salePrice,
      channels: channels || [],
      message: `Listed for $${salePrice.toFixed(2)}${channelList}`,
    });
  } catch (err) {
    console.error("[sales/publish] Error:", err);
    return NextResponse.json(
      { success: false, error: "Publish failed" },
      { status: 500 }
    );
  }
}
