import { Job } from "bullmq";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { sanitizeAiLabel } from "../lib/sanitize";

// =============================================================================
// AI Image Processor — The "Brain" of the Worker
// =============================================================================
// Fetches unprocessed images from the DB, sends them to Ollama (LLaVA),
// and stores the AI analysis back in the database.
// =============================================================================

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llava";
const CLIP_SERVICE_URL = process.env.CLIP_SERVICE_URL || "http://localhost:8100";
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
// Call Ollama LLaVA with an image URL
// ---------------------------------------------------------------------------
async function analyzeImageWithOllama(imageUrl: string): Promise<OllamaAnalysis> {
  // First, fetch the image and convert to base64
  let base64Image: string;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    base64Image = Buffer.from(buffer).toString("base64");
  } catch (error) {
    console.error(`  ⚠ Could not fetch image from ${imageUrl}:`, error);
    throw error;
  }

  // Call Ollama's chat API with the image
  const prompt = `Analyze this image for a product inventory system. 
You MUST respond with ONLY valid JSON, no other text. Use this exact format:
{
  "main_color": "the dominant color of the object",
  "object_type": "what kind of object this is (e.g. server, laptop, switch, cable, monitor)",
  "detected_text": "any visible text, labels, serial numbers, or branding on the object",
  "short_description": "a brief 1-2 sentence description suitable for an inventory catalog"
}`;

  const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [base64Image],
        },
      ],
      stream: false,
      options: {
        temperature: 0.1,      // Low temp for consistent JSON output
        num_predict: 500,      // Limit response length
      },
    }),
  });

  if (!ollamaResponse.ok) {
    const errorText = await ollamaResponse.text();
    throw new Error(`Ollama API error (${ollamaResponse.status}): ${errorText}`);
  }

  const data = await ollamaResponse.json();
  const content: string = data.message?.content || "{}";

  // Extract JSON from the response (LLaVA sometimes wraps in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn(`  ⚠ Could not extract JSON from Ollama response: ${content.slice(0, 200)}`);
    return {
      main_color: "unknown",
      object_type: "unknown",
      detected_text: "",
      short_description: content.slice(0, 200),
    };
  }

  try {
    const raw = JSON.parse(jsonMatch[0]) as OllamaAnalysis;
    return sanitizeAiLabel(raw);
  } catch {
    console.warn(`  ⚠ Invalid JSON from Ollama: ${jsonMatch[0].slice(0, 200)}`);
    return {
      main_color: "unknown",
      object_type: "unknown",
      detected_text: "",
      short_description: content.slice(0, 200),
    };
  }
}

// ---------------------------------------------------------------------------
// Check if Ollama is reachable and model is available
// ---------------------------------------------------------------------------
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!resp.ok) return false;
    const data = await resp.json();
    const models = data.models?.map((m: { name: string }) => m.name) || [];
    const hasModel = models.some((m: string) => m.startsWith(OLLAMA_MODEL));
    if (!hasModel) {
      console.warn(`[Processor] ⚠ Model "${OLLAMA_MODEL}" not found. Available: ${models.join(", ")}`);
      console.warn(`[Processor]   Run: ollama pull ${OLLAMA_MODEL}`);
      return false;
    }
    return true;
  } catch {
    console.error(`[Processor] ❌ Cannot reach Ollama at ${OLLAMA_HOST}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Generate CLIP embedding for an image URL
// ---------------------------------------------------------------------------
async function generateClipEmbedding(imageUrl: string): Promise<number[] | null> {
  try {
    const resp = await fetch(`${CLIP_SERVICE_URL}/embed-image-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: imageUrl }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`    ⚠ CLIP embed failed (${resp.status}): ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const embedding: number[] = data.embedding;

    if (!Array.isArray(embedding) || embedding.length !== 512) {
      console.warn(`    ⚠ CLIP returned unexpected dimensions: ${embedding?.length}`);
      return null;
    }

    return embedding;
  } catch (error) {
    console.warn(`    ⚠ CLIP service unreachable: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Check if CLIP service is reachable
// ---------------------------------------------------------------------------
async function checkClipHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${CLIP_SERVICE_URL}/health`);
    if (!resp.ok) return false;
    const data = await resp.json();
    console.log(`[Processor] ✓ CLIP service ready (model: ${data.model}, dim: ${data.dimensions})`);
    return true;
  } catch {
    console.warn(`[Processor] ⚠ CLIP service not available at ${CLIP_SERVICE_URL} — embeddings will be skipped`);
    return false;
  }
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
      console.error("[Processor] Ollama not available — aborting batch");
      throw new Error(`Ollama not available at ${OLLAMA_HOST} or model "${OLLAMA_MODEL}" missing`);
    }
    console.log(`[Processor] ✓ Ollama is ready (model: ${OLLAMA_MODEL})`);

    // Check CLIP service availability (non-blocking — embeddings are optional)
    const clipAvailable = await checkClipHealth();

    // Fetch unprocessed images
    const images = await prisma.item_images.findMany({
      where: { ai_processed: false },
      include: { items: { select: { id: true, title: true } } },
      take: BATCH_SIZE,
      orderBy: { created_at: "asc" },
    });

    // Also check items with image_url but no item_images entry that hasn't been processed
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
