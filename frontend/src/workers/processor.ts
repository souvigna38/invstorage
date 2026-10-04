import { Job } from "bullmq";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { sanitizeAiLabel } from "../lib/sanitize";
import {
  checkVisionHealth,
  analyzeImage,
  getClipEmbedding,
} from "../lib/vision";

// =============================================================================
// AI Image Processor — The "Brain" of the Worker
// =============================================================================
// Fetches unprocessed images from the DB, sends them to Ollama (LLaVA/qwen3-vl)
// or mock vision provider, and stores the AI analysis back in the database.
// =============================================================================

const BATCH_SIZE = 50;

// Create a dedicated Prisma client for the worker (not shared with Next.js)
function createWorkerPrisma(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
}

interface OllamaAnalysis {
  main_color: string;
  object_type: string;
  detected_text: string;
  short_description: string;
}

// ---------------------------------------------------------------------------
// Call Vision Provider (Ollama or Pluggable Mock)
// ---------------------------------------------------------------------------
async function analyzeImageWithOllama(
  imageUrl: string,
  filename?: string
): Promise<OllamaAnalysis> {
  const result = await analyzeImage(imageUrl, { filename });
  return sanitizeAiLabel({
    main_color: result.main_color,
    object_type: result.object_type,
    detected_text: result.detected_text,
    short_description: result.short_description,
  });
}

// ---------------------------------------------------------------------------
// Check if Vision Provider is available
// ---------------------------------------------------------------------------
async function checkOllamaHealth(): Promise<boolean> {
  const health = await checkVisionHealth();
  if (!health.available) {
    console.error(`[Processor] ❌ Vision provider unavailable: ${health.error}`);
    return false;
  }
  console.log(
    `[Processor] ✓ Vision provider ready: ${health.provider} (model: ${health.model || "default"})`
  );
  return true;
}

// ---------------------------------------------------------------------------
// Generate CLIP embedding for an image URL
// ---------------------------------------------------------------------------
async function generateClipEmbedding(imageUrl: string): Promise<number[] | null> {
  return getClipEmbedding(imageUrl);
}

// ---------------------------------------------------------------------------
// Check if CLIP embedding capability is available
// ---------------------------------------------------------------------------
async function checkClipHealth(): Promise<boolean> {
  const emb = await getClipEmbedding("health_check_probe");
  if (emb && emb.length === 512) {
    console.log(`[Processor] ✓ CLIP embeddings ready (512-dim)`);
    return true;
  }
  console.warn(
    `[Processor] ⚠ CLIP service not available — embeddings will be skipped`
  );
  return false;
}

// ---------------------------------------------------------------------------
// Save embedding to pgvector column using raw SQL
// ---------------------------------------------------------------------------
async function saveEmbedding(prisma: PrismaClient, imageId: number, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE item_images SET embedding = $1::vector WHERE id = $2`,
    vectorStr,
    imageId
  );
}

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------
export async function processUnscannedImages(job: Job): Promise<ProcessResult> {
  const prisma = createWorkerPrisma();
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Health check
    const ollamaOk = await checkOllamaHealth();
    if (!ollamaOk) {
      console.error("[Processor] Vision provider not available — aborting batch");
      throw new Error("Vision provider not available or model missing");
    }

    // Check CLIP service availability (non-blocking — embeddings are optional)
    const clipAvailable = await checkClipHealth();

    // Check items with image_url but no item_images entry that hasn't been processed
    // (for items using direct image_url instead of item_images table)
    const itemsWithUnprocessedMainImage = await prisma.items.findMany({
      where: {
        image_url: { not: null },
        deleted_at: null,
        // Check if there's NO item_image marked as processed for this item
        item_images: {
          none: {
            ai_processed: true,
          },
        },
      },
      select: {
        id: true,
        title: true,
        image_url: true,
        item_images: { select: { id: true } },
      },
      take: BATCH_SIZE,
    });

    // Create item_image entries for items that only have image_url but no item_images
    for (const item of itemsWithUnprocessedMainImage) {
      if (item.item_images.length === 0 && item.image_url) {
        await prisma.item_images.create({
          data: {
            item_id: item.id,
            image_url: item.image_url,
            alt_text: item.title,
            is_primary: true,
            ai_processed: false,
          },
        });
      }
    }

    // Re-fetch to get the complete list
    const allUnprocessed = await prisma.item_images.findMany({
      where: { ai_processed: false },
      include: { items: { select: { id: true, title: true, search_text: true } } },
      take: BATCH_SIZE,
      orderBy: { created_at: "asc" },
    });

    const totalUnprocessed = await prisma.item_images.count({
      where: { ai_processed: false },
    });

    console.log(`[Processor] Found ${allUnprocessed.length} unprocessed images (${totalUnprocessed} total remaining)`);

    if (allUnprocessed.length === 0) {
      console.log("[Processor] No unprocessed images — nothing to do");
      return { processed: 0, failed: 0, skipped: 0, remaining: 0 };
    }

    // Update job progress
    await job.updateProgress(0);

    // Process each image
    for (let i = 0; i < allUnprocessed.length; i++) {
      const img = allUnprocessed[i];
      const itemTitle = img.items?.title || "Unknown";
      const progress = Math.round(((i + 1) / allUnprocessed.length) * 100);

      console.log(`  [${i + 1}/${allUnprocessed.length}] Analyzing: "${itemTitle}" (image #${img.id})...`);

      try {
        // Skip if human-corrected (ai_corrected flag set via UI)
        const correctedRows: { ai_corrected: boolean }[] = await prisma.$queryRawUnsafe(
          `SELECT ai_corrected FROM item_images WHERE id = $1`,
          img.id
        );
        if (correctedRows.length > 0 && correctedRows[0].ai_corrected) {
          console.log(`    ⏭ Skipping — human-corrected (ai_corrected = true)`);
          skipped++;
          continue;
        }

        // Skip if image URL is missing or not HTTP
        if (!img.image_url || (!img.image_url.startsWith("http") && !img.image_url.startsWith("/"))) {
          console.log(`    ⏭ Skipping — invalid URL: ${img.image_url?.slice(0, 50)}`);
          skipped++;
          await prisma.item_images.update({
            where: { id: img.id },
            data: {
              ai_processed: true,
              ai_description: "Skipped: invalid image URL",
              ai_processed_at: new Date(),
            },
          });
          continue;
        }

        // Call Ollama
        const analysis = await analyzeImageWithOllama(img.image_url);

        // Update item_image with AI results
        await prisma.item_images.update({
          where: { id: img.id },
          data: {
            ai_processed: true,
            ai_description: analysis.short_description,
            ai_main_color: analysis.main_color,
            ai_object_type: analysis.object_type,
            ai_detected_text: analysis.detected_text,
            ai_tags: [analysis.main_color, analysis.object_type].filter(Boolean),
            ai_processed_at: new Date(),
          },
        });

        // Generate CLIP embedding (if service is available)
        if (clipAvailable && img.image_url?.startsWith("http")) {
          const embedding = await generateClipEmbedding(img.image_url);
          if (embedding) {
            await saveEmbedding(prisma, img.id, embedding);
            console.log(`    🧬 CLIP embedding saved (512-dim)`);
          }
        }

        // Append keywords to parent item's search_text
        if (img.items) {
          const keywords = [
            analysis.main_color,
            analysis.object_type,
            analysis.detected_text,
            analysis.short_description,
          ]
            .filter(Boolean)
            .join(" ");

          const existingText = img.items.search_text || "";
          const newSearchText = `${existingText} ${keywords}`.trim();

          await prisma.items.update({
            where: { id: img.items.id },
            data: {
              search_text: newSearchText,
              updated_at: new Date(),
            },
          });
        }

        console.log(`    ✅ ${analysis.object_type} | ${analysis.main_color} | "${analysis.short_description?.slice(0, 60)}..."`);
        processed++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`    ❌ Failed: ${errMsg}`);
        failed++;

        // Mark as processed with error so we don't retry forever
        await prisma.item_images.update({
          where: { id: img.id },
          data: {
            ai_processed: true,
            ai_description: `Error: ${errMsg.slice(0, 500)}`,
            ai_processed_at: new Date(),
          },
        });
      }

      // Update progress
      await job.updateProgress(progress);

      // Small delay to avoid overwhelming Ollama
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const remaining = totalUnprocessed - allUnprocessed.length;
    return { processed, failed, skipped, remaining };
  } finally {
    // Clean up the Prisma connection
    await prisma.$disconnect();
  }
}
