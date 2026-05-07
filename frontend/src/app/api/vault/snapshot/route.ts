import { NextResponse } from "next/server";
import { Pool } from "pg";
import * as Minio from "minio";
import { requireAuth } from "@/lib/auth";

// =============================================================================
// POST /api/vault/snapshot — Create a dated snapshot in Vault_SpM1
// =============================================================================
// 1. Creates a snapshot record
// 2. Copies all main DB tables into vault tables
// 3. Fetches image binaries from MinIO and stores them as BYTEA
// =============================================================================

const MAIN_DB_URL = process.env.DATABASE_URL ?? "";
const VAULT_DB_URL = process.env.VAULT_DATABASE_URL ?? "";
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "storage";
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000", 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "inventory";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";

function getMinioClient() {
  return new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });
}

/** Fetch a binary object from MinIO given its full URL */
async function fetchImageFromMinio(
  minio: Minio.Client,
  imageUrl: string
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    // Extract object key from URL like http://localhost:9000/inventory/2026-02-14/photo.jpg
    const bucketPrefix = `/${MINIO_BUCKET}/`;
    const idx = imageUrl.indexOf(bucketPrefix);
    if (idx === -1) return null;
    const objectKey = imageUrl.substring(idx + bucketPrefix.length);

    const stream = await minio.getObject(MINIO_BUCKET, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);

    // Determine content type from extension
    const ext = objectKey.split(".").pop()?.toLowerCase() || "jpg";
    const typeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
      svg: "image/svg+xml",
    };
    const contentType = typeMap[ext] || "application/octet-stream";

    return { data, contentType };
  } catch {
    // Image may not exist in MinIO
    return null;
  }
}

export async function POST(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  if (!MAIN_DB_URL || !VAULT_DB_URL) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL and VAULT_DATABASE_URL must be configured" },
      { status: 500 }
    );
  }

  const mainPool = new Pool({ connectionString: MAIN_DB_URL });
  const vaultPool = new Pool({ connectionString: VAULT_DB_URL });

  try {
    const body = await request.json().catch(() => ({}));
    const label = (body as { label?: string }).label || null;

    // 1. Create snapshot record
    const snapRes = await vaultPool.query(
      `INSERT INTO snapshots (label, status) VALUES ($1, 'in_progress') RETURNING id, snapshot_date`,
      [label]
    );
    const snapshotId = snapRes.rows[0].id;
    const snapshotDate = snapRes.rows[0].snapshot_date;

    // 2. Copy users
    const users = await mainPool.query(`SELECT * FROM users`);
    for (const row of users.rows) {
      await vaultPool.query(
        `INSERT INTO vault_users (snapshot_id, id, name, email, avatar_url, role, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [snapshotId, row.id, row.name, row.email, row.avatar_url, row.role, row.created_at, row.updated_at]
      );
    }

    // 3. Copy categories
    const categories = await mainPool.query(`SELECT * FROM categories`);
    for (const row of categories.rows) {
      await vaultPool.query(
        `INSERT INTO vault_categories (snapshot_id, id, name, slug, description, image_url, parent_id, display_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [snapshotId, row.id, row.name, row.slug, row.description, row.image_url, row.parent_id, row.display_order, row.created_at, row.updated_at]
      );
    }

    // 4. Copy locations
    const locations = await mainPool.query(`SELECT * FROM locations`);
    for (const row of locations.rows) {
      await vaultPool.query(
        `INSERT INTO vault_locations (snapshot_id, id, name, description, address, city, state, country, zip, parent_id, image_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [snapshotId, row.id, row.name, row.description, row.address, row.city, row.state, row.country, row.zip, row.parent_id, row.image_url, row.created_at, row.updated_at]
      );
    }

    // 5. Copy items
    const items = await mainPool.query(`SELECT * FROM items`);
    for (const row of items.rows) {
      await vaultPool.query(
        `INSERT INTO vault_items (snapshot_id, id, title, description, price, image_url, rating, rating_count,
         asset_tag, serial_number, model_name, model_number, manufacturer, category_id, location_id,
         default_location_id, assigned_to_user_id, status, purchase_date, purchase_cost, warranty_months,
         warranty_expires, order_number, supplier, quantity, is_requestable, last_checkout, last_checkin,
         expected_checkin, checkout_counter, notes, custom_fields, cpu_type, ram_amount, hard_drive_info,
         gpu, network_info, role, storage_detail, search_text, estimated_value, msrp_price, msrp_source,
         msrp_lookup_query, msrp_last_checked, list_price, sold_price, sold_date, listing_url,
         medusa_product_id, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53)`,
        [
          snapshotId, row.id, row.title, row.description, row.price, row.image_url, row.rating, row.rating_count,
          row.asset_tag, row.serial_number, row.model_name, row.model_number, row.manufacturer, row.category_id,
          row.location_id, row.default_location_id, row.assigned_to_user_id, row.status, row.purchase_date,
          row.purchase_cost, row.warranty_months, row.warranty_expires, row.order_number, row.supplier,
          row.quantity, row.is_requestable, row.last_checkout, row.last_checkin, row.expected_checkin,
          row.checkout_counter, row.notes, row.custom_fields ? JSON.stringify(row.custom_fields) : null,
          row.cpu_type, row.ram_amount, row.hard_drive_info, row.gpu, row.network_info, row.role,
          row.storage_detail, row.search_text, row.estimated_value, row.msrp_price, row.msrp_source,
          row.msrp_lookup_query, row.msrp_last_checked, row.list_price, row.sold_price, row.sold_date,
          row.listing_url, row.medusa_product_id, row.created_at, row.updated_at, row.deleted_at,
        ]
      );
    }

    // 6. Copy item_images + fetch binary from MinIO (batched parallel)
    const minio = getMinioClient();
    const itemImages = await mainPool.query(`SELECT * FROM item_images`);
    let imageCount = 0;
    let totalImageBytes = 0;
    const IMAGE_BATCH_SIZE = 10;
    const itemImageRows = itemImages.rows as Array<Record<string, unknown> & { image_url?: string }>;

    for (let i = 0; i < itemImageRows.length; i += IMAGE_BATCH_SIZE) {
      const batch = itemImageRows.slice(i, i + IMAGE_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (row) => {
          let imageData: Buffer | null = null;
          let imageContentType: string | null = null;
          let addedBytes = 0;
          let addedCount = 0;

          if (row.image_url) {
            const img = await fetchImageFromMinio(minio, row.image_url);
            if (img) {
              imageData = img.data;
              imageContentType = img.contentType;
              addedBytes = img.data.length;
              addedCount = 1;
            }
          }

          await vaultPool.query(
            `INSERT INTO vault_item_images (snapshot_id, id, item_id, image_url, alt_text, display_order,
             is_primary, created_at, ai_processed, ai_description, ai_main_color, ai_object_type,
             ai_detected_text, ai_tags, ai_processed_at, image_data, image_content_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              snapshotId, row.id, row.item_id, row.image_url, row.alt_text, row.display_order,
              row.is_primary, row.created_at, row.ai_processed, row.ai_description, row.ai_main_color,
              row.ai_object_type, row.ai_detected_text,
              row.ai_tags ? JSON.stringify(row.ai_tags) : null,
              row.ai_processed_at, imageData, imageContentType,
            ]
          );
          return { addedBytes, addedCount };
        })
      );
      for (const r of results) {
        totalImageBytes += r.addedBytes;
        imageCount += r.addedCount;
      }
    }

    // 7. Also backup primary images from items.image_url
    for (const row of items.rows) {
      if (row.image_url) {
        const img = await fetchImageFromMinio(minio, row.image_url);
        if (img) {
          await vaultPool.query(
            `INSERT INTO vault_item_primary_images (snapshot_id, item_id, image_url, image_data, image_content_type)
             VALUES ($1,$2,$3,$4,$5)`,
            [snapshotId, row.id, row.image_url, img.data, img.contentType]
          );
          // Don't double-count if already counted in item_images
          if (!itemImages.rows.some((ii: { image_url: string }) => ii.image_url === row.image_url)) {
            totalImageBytes += img.data.length;
            imageCount++;
          }
        }
      }
    }

    // 8. Copy action_logs
    const actionLogs = await mainPool.query(`SELECT * FROM action_logs`);
    for (const row of actionLogs.rows) {
      await vaultPool.query(
        `INSERT INTO vault_action_logs (snapshot_id, id, action_type, performed_by, item_id, target_user_id,
         from_location_id, to_location_id, note, action_date, expected_return, attachment_url, source,
         ip_address, user_agent, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          snapshotId, row.id, row.action_type, row.performed_by, row.item_id, row.target_user_id,
          row.from_location_id, row.to_location_id, row.note, row.action_date, row.expected_return,
          row.attachment_url, row.source, row.ip_address, row.user_agent,
          row.metadata ? JSON.stringify(row.metadata) : null,
          row.created_at,
        ]
      );
    }

    // 9. Update snapshot status
    await vaultPool.query(
      `UPDATE snapshots SET status = 'complete', item_count = $2, image_count = $3, size_bytes = $4, completed_at = NOW()
       WHERE id = $1`,
      [snapshotId, items.rows.length, imageCount, totalImageBytes]
    );

    return NextResponse.json({
      success: true,
      snapshotId,
      snapshotDate,
      itemCount: items.rows.length,
      imageCount,
      sizeBytes: totalImageBytes,
    });
  } catch (err: unknown) {
    console.error("[Vault] Snapshot failed:", err);
    console.error("[Vault] Snapshot error detail:", err);
    return NextResponse.json({ success: false, error: "Snapshot failed" }, { status: 500 });
  } finally {
    await mainPool.end();
    await vaultPool.end();
  }
}
