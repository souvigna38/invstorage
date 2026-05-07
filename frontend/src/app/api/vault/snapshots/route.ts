import { NextResponse } from "next/server";
import { Pool } from "pg";
import { requireAuth } from "@/lib/auth";

// =============================================================================
// GET /api/vault/snapshots — List all available vault snapshots
// =============================================================================

const VAULT_DB_URL = process.env.VAULT_DATABASE_URL ?? "";

export async function GET(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  if (!VAULT_DB_URL) {
    return NextResponse.json(
      { success: false, error: "VAULT_DATABASE_URL must be configured" },
      { status: 500 }
    );
  }

  const vaultPool = new Pool({ connectionString: VAULT_DB_URL });

  try {
    const result = await vaultPool.query(
      `SELECT id, snapshot_date, label, status, item_count, image_count, size_bytes, created_at, completed_at
       FROM snapshots
       WHERE status = 'complete'
       ORDER BY snapshot_date DESC
       LIMIT 100`
    );

    return NextResponse.json({
      success: true,
      snapshots: result.rows.map((row) => ({
        id: row.id,
        snapshotDate: row.snapshot_date,
        label: row.label,
        status: row.status,
        itemCount: row.item_count,
        imageCount: row.image_count,
        sizeBytes: row.size_bytes,
        sizeMB: row.size_bytes ? (Number(row.size_bytes) / (1024 * 1024)).toFixed(1) : "0",
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
    });
  } catch (err: unknown) {
    console.error("[Vault] List snapshots failed:", err);
    console.error("[Vault] List snapshots error:", err);
    return NextResponse.json({ success: false, error: "Failed to list snapshots" }, { status: 500 });
  } finally {
    await vaultPool.end();
  }
}
