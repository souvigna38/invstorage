"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// =============================================================================
// TRANSFER ITEM — moves an item to a new location
// Replaces Stripe's checkout flow with a location transfer
// =============================================================================
export async function transferItem(
  itemId: number,
  newLocationId: number,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const item = await prisma.items.findUnique({
      where: { id: itemId },
    });

    if (!item || item.deleted_at) {
      return { success: false, error: "Item not found" };
    }

    // Update item location
    await prisma.items.update({
      where: { id: itemId },
      data: {
        location_id: newLocationId,
        updated_at: new Date(),
      },
    });

    // Log the transfer action
    await prisma.action_logs.create({
      data: {
        action_type: "transfer",
        performed_by: 1, // Default admin user for now
        item_id: itemId,
        from_location_id: item.location_id,
        to_location_id: newLocationId,
        note: note || `Moved to new location`,
        action_date: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Transfer failed:", error);
    return { success: false, error: "Transfer failed" };
  }
}

// =============================================================================
// CHECK OUT ITEM — assigns item to a user
// Replaces Stripe "Add to Cart" + "Purchase" with asset checkout
// =============================================================================
export async function checkoutItem(
  itemId: number,
  userId: number = 2,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const item = await prisma.items.findUnique({
      where: { id: itemId },
    });

    if (!item || item.deleted_at) {
      return { success: false, error: "Item not found" };
    }

    if (item.status !== "available") {
      return { success: false, error: `Item is ${item.status}, not available` };
    }

    await prisma.items.update({
      where: { id: itemId },
      data: {
        status: "checked_out",
        assigned_to_user_id: userId,
        last_checkout: new Date(),
        checkout_counter: { increment: 1 },
        updated_at: new Date(),
      },
    });

    await prisma.action_logs.create({
      data: {
        action_type: "checkout",
        performed_by: 1,
        item_id: itemId,
        target_user_id: userId,
        note: note || "Checked out",
        action_date: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Checkout failed:", error);
    return { success: false, error: "Checkout failed" };
  }
}

// =============================================================================
// UPDATE ITEM — Quick Edit from the Detail page (Phase 3: Write Layer)
// =============================================================================
export async function updateItem(
  itemId: number,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Helper: returns trimmed string or null if blank
    const str = (key: string): string | null => {
      const v = formData.get(key);
      if (typeof v !== "string") return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    // Helper: returns parsed float or null
    const num = (key: string): number | null => {
      const v = str(key);
      if (v === null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    // Helper: returns parsed int or null
    const int = (key: string): number | null => {
      const v = str(key);
      if (v === null) return null;
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    };

    const data: Record<string, unknown> = {
      // General
      title: str("title") ?? undefined,
      asset_tag: str("asset_tag"),
      serial_number: str("serial_number"),
      status: str("status") ?? undefined,
      price: num("price"),
      estimated_value: num("estimated_value"),
      msrp_price: num("msrp_price"),
      list_price: num("list_price"),
      sold_price: num("sold_price"),
      quantity: int("quantity") ?? 1,
      manufacturer: str("manufacturer"),
      model_name: str("model_name"),
      model_number: str("model_number"),
      image_url: str("image_url"),

      // Hardware Specs
      cpu_type: str("cpu_type"),
      ram_amount: str("ram_amount"),
      hard_drive_info: str("hard_drive_info"),
      gpu: str("gpu"),
      network_info: str("network_info"),
      role: str("role"),
      storage_detail: str("storage_detail"),

      // Details
      description: str("description"),
      notes: str("notes"),
      supplier: str("supplier"),
      order_number: str("order_number"),
      warranty_months: int("warranty_months"),

      // Timestamp
      updated_at: new Date(),
    };

    // Remove undefined values so Prisma doesn't error on them
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    await prisma.items.update({
      where: { id: itemId },
      data: cleanData,
    });

    // Log the edit
    await prisma.action_logs.create({
      data: {
        action_type: "update",
        performed_by: 1, // Default admin user
        item_id: itemId,
        note: "Item details updated via Quick Edit",
        action_date: new Date(),
      },
    });

    revalidatePath(`/item/${itemId}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Update failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Update failed",
    };
  }
}

// =============================================================================
// BACKFILL ASSET TAGS — assigns LPN-XXXX to items with NULL asset_tag
// Run once from dashboard to "upgrade" existing data
// =============================================================================
export async function backfillAssetTags(): Promise<{
  success: boolean;
  tagged: number;
  error?: string;
}> {
  try {
    // Find the highest existing LPN number so we don't collide
    const allTags = await prisma.items.findMany({
      where: {
        asset_tag: { startsWith: "LPN-" },
        deleted_at: null,
      },
      select: { asset_tag: true },
      orderBy: { asset_tag: "desc" },
    });

    let maxNum = 0;
    for (const item of allTags) {
      const num = parseInt(item.asset_tag!.replace("LPN-", ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    // Find all items without an asset tag
    const untagged = await prisma.items.findMany({
      where: { asset_tag: null, deleted_at: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (untagged.length === 0) {
      return { success: true, tagged: 0 };
    }

    // Assign sequential LPN tags
    let counter = maxNum;
    for (const item of untagged) {
      counter++;
      const newTag = `LPN-${counter.toString().padStart(4, "0")}`;
      await prisma.items.update({
        where: { id: item.id },
        data: { asset_tag: newTag, updated_at: new Date() },
      });
    }

    revalidatePath("/");
    return { success: true, tagged: untagged.length };
  } catch (error) {
    console.error("Backfill failed:", error);
    return {
      success: false,
      tagged: 0,
      error: error instanceof Error ? error.message : "Backfill failed",
    };
  }
}

// =============================================================================
// CHECK IN ITEM — returns item to available status
// Replaces Stripe "Refund" with asset check-in
// =============================================================================
export async function checkinItem(
  itemId: number,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const item = await prisma.items.findUnique({
      where: { id: itemId },
    });

    if (!item || item.deleted_at) {
      return { success: false, error: "Item not found" };
    }

    await prisma.items.update({
      where: { id: itemId },
      data: {
        status: "available",
        assigned_to_user_id: null,
        last_checkin: new Date(),
        expected_checkin: null,
        location_id: item.default_location_id ?? item.location_id,
        updated_at: new Date(),
      },
    });

    await prisma.action_logs.create({
      data: {
        action_type: "checkin",
        performed_by: 1,
        item_id: itemId,
        from_location_id: item.location_id,
        to_location_id: item.default_location_id,
        note: note || "Checked in",
        action_date: new Date(),
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Checkin failed:", error);
    return { success: false, error: "Checkin failed" };
  }
}

// =============================================================================
// MERGE ITEMS — combine duplicate items into one, consolidate photos
// =============================================================================
export async function mergeItems(
  itemIds: number[]
): Promise<{ success: boolean; primaryId?: number; mergedCount?: number; photosKept?: number; error?: string }> {
  if (itemIds.length < 2) {
    return { success: false, error: "Need at least 2 items to merge" };
  }

  try {
    // 1. Load all items with their images
    const items = await prisma.items.findMany({
      where: { id: { in: itemIds }, deleted_at: null },
      include: {
        item_images: { orderBy: { display_order: "asc" } },
      },
      orderBy: { created_at: "asc" },
    });

    if (items.length < 2) {
      return { success: false, error: "Could not find enough valid items to merge" };
    }

    // 2. Pick the primary item — prefer item with AI label, then most images, then earliest
    const primaryItem = items.reduce((best, item) => {
      const bestHasLabel = best.item_images.some((img) => img.ai_processed);
      const itemHasLabel = item.item_images.some((img) => img.ai_processed);
      if (itemHasLabel && !bestHasLabel) return item;
      if (!itemHasLabel && bestHasLabel) return best;
      if (item.item_images.length > best.item_images.length) return item;
      return best;
    });

    const secondaryItems = items.filter((i) => i.id !== primaryItem.id);

    // 3. Collect all images from all items, deduplicate by image_url
    const allImages = items.flatMap((item) => item.item_images);
    const seenUrls = new Set<string>();
    const uniqueImages: typeof allImages = [];
    const duplicateImageIds: number[] = [];

    for (const img of allImages) {
      if (seenUrls.has(img.image_url)) {
        duplicateImageIds.push(img.id);
      } else {
        seenUrls.add(img.image_url);
        uniqueImages.push(img);
      }
    }

    // Run the entire merge inside a transaction for data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 4. Move all unique images from secondary items to the primary item
      let displayOrder = primaryItem.item_images.length;
      for (const img of uniqueImages) {
        if (img.item_id !== primaryItem.id) {
          await tx.item_images.update({
            where: { id: img.id },
            data: {
              item_id: primaryItem.id,
              is_primary: false,
              display_order: displayOrder++,
            },
          });
        }
      }

      // 5. Ensure primary item has exactly one is_primary image
      const primaryImages = await tx.item_images.findMany({
        where: { item_id: primaryItem.id },
        orderBy: { display_order: "asc" },
      });
      if (primaryImages.length > 0) {
        for (let i = 0; i < primaryImages.length; i++) {
          await tx.item_images.update({
            where: { id: primaryImages[i].id },
            data: {
              is_primary: i === 0,
              display_order: i,
            },
          });
        }
        await tx.items.update({
          where: { id: primaryItem.id },
          data: { image_url: primaryImages[0].image_url, updated_at: new Date() },
        });
      }

      // 6. Delete duplicate images
      if (duplicateImageIds.length > 0) {
        await tx.item_images.deleteMany({
          where: { id: { in: duplicateImageIds } },
        });
      }

      // 7. Merge notes from secondary items
      const mergedNotes = [
        primaryItem.notes || "",
        `\n--- Merged ${secondaryItems.length} item(s) on ${new Date().toLocaleDateString()} ---`,
        ...secondaryItems.map(
          (si) => `Merged item #${si.id}: "${si.title}"${si.notes ? ` | Notes: ${si.notes}` : ""}`
        ),
      ]
        .filter(Boolean)
        .join("\n");

      await tx.items.update({
        where: { id: primaryItem.id },
        data: {
          notes: mergedNotes.trim(),
          updated_at: new Date(),
        },
      });

      // 8. Soft-delete secondary items
      for (const si of secondaryItems) {
        await tx.items.update({
          where: { id: si.id },
          data: {
            deleted_at: new Date(),
            notes: `${si.notes || ""}\n[MERGED into item #${primaryItem.id} on ${new Date().toISOString()}]`.trim(),
            updated_at: new Date(),
          },
        });
      }

      // 9. Log the merge
      await tx.action_logs.create({
        data: {
          action_type: "update",
          performed_by: 1,
          item_id: primaryItem.id,
          note: `Merged ${secondaryItems.length} duplicate(s) into this item. Deleted item IDs: ${secondaryItems.map((s) => s.id).join(", ")}. Photos kept: ${primaryImages.length}, duplicates removed: ${duplicateImageIds.length}.`,
          action_date: new Date(),
        },
      });

      return { photosKept: primaryImages.length };
    });

    revalidatePath("/");
    revalidatePath(`/item/${primaryItem.id}`);

    return {
      success: true,
      primaryId: primaryItem.id,
      mergedCount: secondaryItems.length,
      photosKept: result.photosKept,
    };
  } catch (error) {
    console.error("Merge failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Merge failed",
    };
  }
}

// =============================================================================
// CORRECT AI LABEL — human override for AI-generated identification
// Updates both the item and item_image tables, and sets ai_corrected = true
// so the nightly worker and label scripts won't overwrite the correction.
// =============================================================================
export async function correctAiLabel(
  itemId: number,
  imageId: number,
  corrections: {
    title: string;
    description: string;
    object_type: string;
    main_color: string;
    detected_text: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update the parent item (title, description, search_text)
    const searchText = [
      corrections.main_color,
      corrections.object_type,
      corrections.detected_text,
      corrections.description,
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.items.update({
      where: { id: itemId },
      data: {
        title: corrections.title,
        description: corrections.description,
        search_text: searchText,
        updated_at: new Date(),
      },
    });

    // 2. Update the item_image AI fields + set ai_corrected flag via raw SQL
    //    (Prisma schema doesn't include ai_corrected since it's managed via SQL)
    await prisma.$executeRawUnsafe(
      `UPDATE item_images
       SET ai_description  = $1,
           ai_object_type  = $2,
           ai_main_color   = $3,
           ai_detected_text = $4,
           ai_tags          = $5::jsonb,
           ai_corrected     = TRUE,
           ai_processed     = TRUE,
           ai_processed_at  = NOW()
       WHERE id = $6`,
      corrections.description,
      corrections.object_type,
      corrections.main_color,
      corrections.detected_text,
      JSON.stringify(
        [corrections.main_color, corrections.object_type].filter(Boolean)
      ),
      imageId
    );

    // 3. Log the correction
    await prisma.action_logs.create({
      data: {
        action_type: "update",
        performed_by: 1,
        item_id: itemId,
        note: `AI label corrected by user: "${corrections.object_type}" — "${corrections.description?.slice(0, 80)}"`,
        action_date: new Date(),
      },
    });

    revalidatePath(`/item/${itemId}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("AI label correction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Correction failed",
    };
  }
}
