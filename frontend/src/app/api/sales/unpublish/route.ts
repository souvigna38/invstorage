// =============================================================================
// POST /api/sales/unpublish — Remove an inventory item from Medusa
// =============================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteProduct } from "@/lib/medusa";
import { requireAuth, ADMIN_USER_ID } from "@/lib/auth";

export async function POST(req: Request) {
  const authErr = requireAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== "number" || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ success: false, error: "Valid positive integer itemId required" }, { status: 400 });
    }

    // 1. Fetch the inventory item
    const item = await prisma.items.findUnique({
      where: { id: itemId, deleted_at: null },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    if (!item.medusa_product_id) {
      return NextResponse.json({ success: false, error: "Item is not listed for sale" }, { status: 400 });
    }

    // 2. Delete from Medusa
    await deleteProduct(item.medusa_product_id);

    // 3. Clear the Medusa product ID
    await prisma.items.update({
      where: { id: itemId },
      data: {
        medusa_product_id: null,
        updated_at: new Date(),
      },
    });

    // 4. Log the action
    await prisma.action_logs.create({
      data: {
        action_type: "update",
        performed_by: ADMIN_USER_ID,
        item_id: itemId,
        note: `Removed from Medusa sales listing (was: ${item.medusa_product_id})`,
        action_date: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Listing removed" });
  } catch (err) {
    console.error("[sales/unpublish] Error:", err);
    return NextResponse.json(
      { success: false, error: "Unpublish failed" },
      { status: 500 }
    );
  }
}
