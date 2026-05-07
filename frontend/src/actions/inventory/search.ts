"use server";

import { prisma } from "@/lib/prisma";
import type { SemanticSearchResult, HybridSearchResults } from "@/lib/types";
import { getProducts } from "./queries";

// =============================================================================
// SEMANTIC SEARCH — vector similarity via CLIP + pgvector
// =============================================================================
const CLIP_SERVICE_URL = process.env.CLIP_SERVICE_URL || "http://localhost:8100";

/**
 * Convert user text to a CLIP embedding via the clip-service.
 */
async function getTextEmbedding(text: string): Promise<number[] | null> {
  try {
    const resp = await fetch(`${CLIP_SERVICE_URL}/embed-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.embedding as number[];
  } catch {
    return null;
  }
}

/**
 * Semantic search: "Red Sweater" → CLIP vector → cosine similarity in pgvector.
 * Returns the top-N most visually similar items.
 */
export async function semanticSearch(
  query: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  const embedding = await getTextEmbedding(query);
  if (
    !embedding ||
    !Array.isArray(embedding) ||
    embedding.length === 0 ||
    !embedding.every((v) => typeof v === "number" && Number.isFinite(v))
  ) {
    if (embedding) {
      console.warn("[semanticSearch] Invalid embedding received — rejecting for safety");
    } else {
      console.warn("[semanticSearch] CLIP service unavailable — skipping vector search");
    }
    return [];
  }

  const vectorStr = `[${embedding.join(",")}]`;

  // Use raw SQL because Prisma doesn't natively support pgvector operators
  const results: SemanticSearchResult[] = await prisma.$queryRawUnsafe(
    `
    SELECT
      ii.item_id,
      ii.id          AS image_id,
      ii.image_url,
      i.title,
      i.asset_tag,
      i.manufacturer,
      i.model_name,
      (ii.embedding <=> $1::vector) AS distance
    FROM item_images ii
    JOIN items i ON i.id = ii.item_id AND i.deleted_at IS NULL
    WHERE ii.embedding IS NOT NULL
    ORDER BY ii.embedding <=> $1::vector
    LIMIT $2
    `,
    vectorStr,
    limit
  );

  return results.map((r) => ({
    ...r,
    distance: Number(r.distance),
    similarity: Math.round((1 - Number(r.distance)) * 100) / 100,
  }));
}

/**
 * Hybrid search: combines traditional text search with vector similarity.
 * Returns both result sets so the UI can merge/display them.
 */
export async function hybridSearch(
  query: string,
  limit: number = 10
): Promise<HybridSearchResults> {
  // Run text search and vector search in parallel
  const [textResults, vectorResults] = await Promise.all([
    getProducts(query),
    semanticSearch(query, limit),
  ]);

  return {
    textResults: textResults.slice(0, limit),
    vectorResults,
    query,
  };
}
