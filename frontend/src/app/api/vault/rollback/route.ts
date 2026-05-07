import { NextResponse } from "next/server";
import { Pool } from "pg";
import * as Minio from "minio";
import { Readable } from "stream";
import { requireAuth } from "@/lib/auth";

// =============================================================================
// POST /api/vault/rollback — Restore main DB + MinIO from a vault snapshot
// =============================================================================
// 1. Validates the snapshot exists and is complete
// 2. Clears main DB tables (in FK-safe order)
// 3. Re-inserts all data from vault tables
// 4. Uploads image binaries back to MinIO
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

/** Upload binary data back to MinIO from vault */
async function uploadImageToMinio(
  minio: Minio.Client,
  imageUrl: string,
  data: Buffer,
  contentType: string
): Promise<boolean> {
  try {
    const bucketPrefix = `/${MINIO_BUCKET}/`;
    const idx = imageUrl.indexOf(bucketPrefix);
    if (idx === -1) return false;
    const objectKey = imageUrl.substring(idx + bucketPrefix.length);

    const stream = new Readable();
    stream.push(data);
    stream.push(null);

    await minio.putObject(MINIO_BUCKET, objectKey, stream, data.length, {
      "Content-Type": contentType,
    });
    return true;
  } catch (err) {
    console.error(`[Vault] Failed to upload image ${imageUrl}:`, err);
    return false;
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
    const body = await request.json();
    const snapshotId = (body as { snapshotId?: number }).snapshotId;

    if (!snapshotId) {
      return NextResponse.json(
        { success: false, error: "snapshotId is required" },
        { status: 400 }
      );
    }

    // 1. Validate snapshot exists
    const snapRes = await vaultPool.query(
      `SELECT id, snapshot_date, status, item_count FROM snapshots WHERE id = $1`,
      [snapshotId]
    );
    if (snapRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Snapshot not found" },
        { status: 404 }
      );
    }
    if (snapRes.rows[0].status !== "complete") {
      return NextResponse.json(
        { success: false, error: "Snapshot is not complete" },
        { status: 400 }
      );
    }
    const snapshotDate = snapRes.rows[0].snapshot_date;

    // 2. Clear main DB tables (FK-safe order: children first)
    const mainClient = await mainPool.connect();
    try {
      await mainClient.query("BEGIN");

      // Disable triggers temporarily for clean truncation
      await mainClient.query("SET session_replication_role = 'replica'");

      await mainClient.query("TRUNCATE action_logs RESTART IDENTITY CASCADE");
      await mainClient.query("TRUNCATE item_images RESTART IDENTITY CASCADE");
      await mainClient.query("TRUNCATE items RESTART IDENTITY CASCADE");
      await mainClient.query("TRUNCATE locations RESTART IDENTITY CASCADE");
      await mainClient.query("TRUNCATE categories RESTART IDENTITY CASCADE");
      await mainClient.query("TRUNCATE users RESTART IDENTITY CASCADE");

      // 3. Restore users
      const users = await vaultPool.query(
        `SELECT * FROM vault_users WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of users.rows) {
        await mainClient.query(
          `INSERT INTO users (id, name, email, avatar_url, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [row.id, row.name, row.email, row.avatar_url, row.role, row.created_at, row.updated_at]
        );
      }

      // 4. Restore categories
      const categories = await vaultPool.query(
        `SELECT * FROM vault_categories WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of categories.rows) {
        await mainClient.query(
          `INSERT INTO categories (id, name, slug, description, image_url, parent_id, display_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [row.id, row.name, row.slug, row.description, row.image_url, row.parent_id, row.display_order, row.created_at, row.updated_at]
        );
      }

      // 5. Restore locations
      const locations = await vaultPool.query(
        `SELECT * FROM vault_locations WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of locations.rows) {
        await mainClient.query(
          `INSERT INTO locations (id, name, description, address, city, state, country, zip, parent_id, image_url, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [row.id, row.name, row.description, row.address, row.city, row.state, row.country, row.zip, row.parent_id, row.image_url, row.created_at, row.updated_at]
        );
      }

      // 6. Restore items
      const items = await vaultPool.query(
        `SELECT * FROM vault_items WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of items.rows) {
        await mainClient.query(
          `INSERT INTO items (id, title, description, price, image_url, rating, rating_count,
           asset_tag, serial_number, model_name, model_number, manufacturer, category_id, location_id,
           default_location_id, assigned_to_user_id, status, purchase_date, purchase_cost, warranty_months,
           warranty_expires, order_number, supplier, quantity, is_requestable, last_checkout, last_checkin,
           expected_checkin, checkout_counter, notes, custom_fields, cpu_type, ram_amount, hard_drive_info,
           gpu, network_info, role, storage_detail, search_text, estimated_value, msrp_price, msrp_source,
           msrp_lookup_query, msrp_last_checked, list_price, sold_price, sold_date, listing_url,
           medusa_product_id, created_at, updated_at, deleted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52)`,
          [
            row.id, row.title, row.description, row.price, row.image_url, row.rating, row.rating_count,
            row.asset_tag, row.serial_number, row.model_name, row.model_number, row.manufacturer,
            row.category_id, row.location_id, row.default_location_id, row.assigned_to_user_id, row.status,
            row.purchase_date, row.purchase_cost, row.warranty_months, row.warranty_expires, row.order_number,
            row.supplier, row.quantity, row.is_requestable, row.last_checkout, row.last_checkin,
            row.expected_checkin, row.checkout_counter, row.notes,
            row.custom_fields ? JSON.stringify(row.custom_fields) : null,
            row.cpu_type, row.ram_amount, row.hard_drive_info, row.gpu, row.network_info, row.role,
            row.storage_detail, row.search_text, row.estimated_value, row.msrp_price, row.msrp_source,
            row.msrp_lookup_query, row.msrp_last_checked, row.list_price, row.sold_price, row.sold_date,
            row.listing_url, row.medusa_product_id, row.created_at, row.updated_at, row.deleted_at,
          ]
        );
      }

      // 7. Restore item_images
      const itemImages = await vaultPool.query(
        `SELECT * FROM vault_item_images WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of itemImages.rows) {
        await mainClient.query(
          `INSERT INTO item_images (id, item_id, image_url, alt_text, display_order, is_primary, created_at,
           ai_processed, ai_description, ai_main_color, ai_object_type, ai_detected_text, ai_tags, ai_processed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            row.id, row.item_id, row.image_url, row.alt_text, row.display_order, row.is_primary,
            row.created_at, row.ai_processed, row.ai_description, row.ai_main_color, row.ai_object_type,
            row.ai_detected_text, row.ai_tags ? JSON.stringify(row.ai_tags) : null, row.ai_processed_at,
          ]
        );
      }

      // 8. Restore action_logs
      const actionLogs = await vaultPool.query(
        `SELECT * FROM vault_action_logs WHERE snapshot_id = $1`,
        [snapshotId]
      );
      for (const row of actionLogs.rows) {
        await mainClient.query(
          `INSERT INTO action_logs (id, action_type, performed_by, item_id, target_user_id, from_location_id,
           to_location_id, note, action_date, expected_return, attachment_url, source, ip_address, user_agent,
           metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            row.id, row.action_type, row.performed_by, row.item_id, row.target_user_id, row.from_location_id,
            row.to_location_id, row.note, row.action_date, row.expected_return, row.attachment_url, row.source,
            row.ip_address, row.user_agent, row.metadata ? JSON.stringify(row.metadata) : null, row.created_at,
          ]
        );
      }

      // 9. Reset sequences to max id + 1
      await mainClient.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)`);
      await mainClient.query(`SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 0) + 1, false)`);
      await mainClient.query(`SELECT setval('locations_id_seq', COALESCE((SELECT MAX(id) FROM locations), 0) + 1, false)`);
      await mainClient.query(`SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 0) + 1, false)`);
      await mainClient.query(`SELECT setval('item_images_id_seq', COALESCE((SELECT MAX(id) FROM item_images), 0) + 1, false)`);
      await mainClient.query(`SELECT setval('action_logs_id_seq', COALESCE((SELECT MAX(id) FROM action_logs), 0) + 1, false)`);

      // Re-enable triggers
      await mainClient.query("SET session_replication_role = 'origin'");

      await mainClient.query("COMMIT");
    } catch (err) {
      await mainClient.query("ROLLBACK");
      throw err;
    } finally {
      mainClient.release();
    }

    // 10. Restore images to MinIO (outside transaction)
    const minio = getMinioClient();
    let imagesRestored = 0;

    // Restore item_images binaries
    const vaultImages = await vaultPool.query(
      `SELECT image_url, image_data, image_content_type FROM vault_item_images
       WHERE snapshot_id = $1 AND image_data IS NOT NULL`,
      [snapshotId]
    );
    for (const row of vaultImages.rows) {
      const ok = await uploadImageToMinio(minio, row.image_url, row.image_data, row.image_content_type);
      if (ok) imagesRestored++;
    }

    // Restore primary images binaries
    const vaultPrimary = await vaultPool.query(
      `SELECT image_url, image_data, image_content_type FROM vault_item_primary_images
       WHERE snapshot_id = $1 AND image_data IS NOT NULL`,
      [snapshotId]
    );
    for (const row of vaultPrimary.rows) {
      const ok = await uploadImageToMinio(minio, row.image_url, row.image_data, row.image_content_type);
      if (ok) imagesRestored++;
    }

    return NextResponse.json({
      success: true,
      snapshotId,
      snapshotDate,
      itemsRestored: snapRes.rows[0].item_count,
      imagesRestored,
    });
  } catch (err: unknown) {
    console.error("[Vault] Rollback failed:", err);
    console.error("[Vault] Rollback error detail:", err);
    return NextResponse.json({ success: false, error: "Rollback failed" }, { status: 500 });
  } finally {
    await mainPool.end();
    await vaultPool.end();
  }
}
