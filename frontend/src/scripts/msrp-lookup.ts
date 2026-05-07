import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// =============================================================================
// MSRP Lookup Script — Google Shopping Price Search
// =============================================================================
//
// Searches Google Shopping for each inventory item's original retail price.
// Uses SerpAPI (free: 100 searches/month) for structured results.
//
// Usage:
//   npm run msrp                   # Process all items missing MSRP
//   npm run msrp -- --item 42      # Lookup a specific item
//   npm run msrp -- --force        # Re-check even if already looked up
//   npm run msrp -- --dry-run      # Preview queries without searching
//
// Requires: SERPAPI_KEY in .env (get free key at serpapi.com)
// =============================================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://admin:secure_password@localhost:5432/inventory?schema=public";

// Max items to process in one run (respect SerpAPI free tier)
const BATCH_LIMIT = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createPrisma(): PrismaClient {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** Build a search query from item metadata. */
function buildSearchQuery(item: {
  title: string;
  manufacturer: string | null;
  model_name: string | null;
  model_number: string | null;
  description: string | null;
  ai_object_type?: string | null;
}): string {
  const parts: string[] = [];

  // Prefer manufacturer + model for precise results
  if (item.manufacturer) parts.push(item.manufacturer);
  if (item.model_name) parts.push(item.model_name);
  if (item.model_number && !parts.some((p) => p.includes(item.model_number!))) {
    parts.push(item.model_number);
  }

  // If no manufacturer/model, use the title (but clean it up)
  if (parts.length === 0) {
    let cleaned = item.title
      .replace(/^Photo Inbox:\s*/i, "")
      .replace(/^IMG\s*\d+/i, "")
      .replace(/\s*—\s*/g, " ")
      .trim();
    if (cleaned.length > 3) {
      parts.push(cleaned);
    }
  }

  // Append "price" to bias towards price-showing results
  const query = parts.join(" ").trim();
  return query ? `${query} price` : "";
}

// ---------------------------------------------------------------------------
// SerpAPI Google Shopping Search
// ---------------------------------------------------------------------------

interface ShoppingResult {
  title: string;
  price: number | null;
  source: string;
  link: string;
  thumbnail: string | null;
}

async function searchGoogleShopping(query: string): Promise<ShoppingResult[]> {
  if (!SERPAPI_KEY) {
    console.warn("  [MSRP] No SERPAPI_KEY — skipping API search");
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: SERPAPI_KEY,
      engine: "google_shopping",
      q: query,
      num: "5",
      hl: "en",
      gl: "us",
    });

    const resp = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`  [MSRP] SerpAPI error (${resp.status}): ${errText.slice(0, 200)}`);
      return [];
    }

    const data = await resp.json();
    const results: ShoppingResult[] = [];

    // Parse shopping results
    const shoppingResults = data.shopping_results || [];
    for (const item of shoppingResults.slice(0, 5)) {
      let price: number | null = null;

      // Extract price — can be in various formats
      if (item.extracted_price != null) {
        price = parseFloat(String(item.extracted_price));
      } else if (item.price) {
        const priceStr = String(item.price).replace(/[^0-9.]/g, "");
        price = parseFloat(priceStr);
      }

      if (isNaN(price!)) price = null;

      results.push({
        title: item.title || "",
        price,
        source: item.source || "",
        link: item.link || item.product_link || "",
        thumbnail: item.thumbnail || null,
      });
    }

    return results;
  } catch (error) {
    console.warn(
      `  [MSRP] Search error: ${error instanceof Error ? error.message : error}`
    );
    return [];
  }
}

/** Fallback: search regular Google for price mentions. */
async function searchGoogleOrganic(query: string): Promise<ShoppingResult[]> {
  if (!SERPAPI_KEY) return [];

  try {
    const params = new URLSearchParams({
      api_key: SERPAPI_KEY,
      engine: "google",
      q: query,
      num: "5",
      hl: "en",
      gl: "us",
    });

    const resp = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!resp.ok) return [];

    const data = await resp.json();
    const results: ShoppingResult[] = [];

    for (const item of (data.organic_results || []).slice(0, 5)) {
      // Try to extract price from snippet
      let price: number | null = null;
      const snippet = item.snippet || "";
      const priceMatch = snippet.match(/\$[\d,]+\.?\d*/);
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/[$,]/g, ""));
        if (isNaN(price)) price = null;
      }

      results.push({
        title: item.title || "",
        price,
        source: new URL(item.link || "https://unknown").hostname,
        link: item.link || "",
        thumbnail: null,
      });
    }

    return results;
  } catch {
    return [];
  }
}

/** Compute MSRP from search results: use median of valid prices. */
function computeMsrp(results: ShoppingResult[]): {
  msrp: number | null;
  source: string;
} {
  const prices = results
    .filter((r) => r.price != null && r.price > 0)
    .map((r) => r.price!);

  if (prices.length === 0) return { msrp: null, source: "no results" };

  // Sort and take median
  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];

  // Build source string from top results
  const topSources = results
    .filter((r) => r.price != null)
    .slice(0, 3)
    .map((r) => `${r.source}: $${r.price!.toFixed(2)}`)
    .join(" | ");

  return {
    msrp: Math.round(median * 100) / 100,
    source: topSources,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const itemArg = args.find((a) => a === "--item");
  const specificItemId = itemArg
    ? parseInt(args[args.indexOf(itemArg) + 1], 10)
    : null;

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  InvStorage MSRP Lookup — Google Shopping Price Search");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  SerpAPI Key: ${SERPAPI_KEY ? "✓ configured" : "✗ NOT SET"}`);
  console.log(`  Database:    ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`  Batch limit: ${BATCH_LIMIT}`);
  if (specificItemId) console.log(`  Item:        #${specificItemId}`);
  if (force) console.log(`  Mode:        FORCE (re-check all)`);
  if (dryRun) console.log(`  Mode:        DRY RUN (no changes)`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  if (!SERPAPI_KEY) {
    console.error("[MSRP] SERPAPI_KEY not set in environment.");
    console.error("[MSRP] Get a free key at: https://serpapi.com (100 searches/month)");
    console.error("[MSRP] Add to .env: SERPAPI_KEY=your_key_here");
    console.error("");
    // Even without the key, show what queries would be built
    console.log("[MSRP] Running in preview mode (showing queries only)...\n");
  }

  const prisma = createPrisma();

  // Find items to process
  const where: Record<string, unknown> = {
    deleted_at: null,
  };

  if (specificItemId) {
    where.id = specificItemId;
  } else if (!force) {
    // Only items that haven't been looked up yet
    where.msrp_last_checked = null;
  }

  const items = await prisma.items.findMany({
    where: where as never,
    include: {
      item_images: {
        where: { is_primary: true },
        take: 1,
      },
    },
    orderBy: { id: "asc" },
    take: BATCH_LIMIT,
  });

  if (items.length === 0) {
    console.log("[MSRP] No items need MSRP lookup.");
    console.log("[MSRP] Use --force to re-check all items.");
    await prisma.$disconnect();
    return;
  }

  console.log(`[MSRP] Processing ${items.length} item(s)...\n`);

  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const primaryImage = item.item_images[0];

    // Get AI object type from item_images if available
    const aiObjectType = primaryImage
      ? ((primaryImage as Record<string, unknown>).ai_object_type as string) ?? null
      : null;

    const query = buildSearchQuery({
      title: item.title,
      manufacturer: item.manufacturer,
      model_name: item.model_name,
      model_number: item.model_number,
      description: item.description,
      ai_object_type: aiObjectType,
    });

    console.log(`[${i + 1}/${items.length}] #${item.id}: ${item.title}`);
    console.log(`  Query: "${query}"`);

    if (!query || query === "price") {
      console.log(`  Skipped: insufficient metadata for search\n`);
      skipped++;
      continue;
    }

    if (dryRun || !SERPAPI_KEY) {
      console.log(`  ${dryRun ? "Dry run" : "No API key"}: would search Google Shopping\n`);
      skipped++;
      continue;
    }

    // Search Google Shopping first, then organic as fallback
    let results = await searchGoogleShopping(query);
    let searchType = "Google Shopping";

    if (results.filter((r) => r.price).length === 0) {
      // Fallback to organic search
      results = await searchGoogleOrganic(query);
      searchType = "Google Organic";
    }

    const { msrp, source } = computeMsrp(results);

    if (msrp !== null) {
      console.log(`  Found MSRP: $${msrp.toFixed(2)} (via ${searchType})`);
      console.log(`  Sources: ${source}`);

      await prisma.items.update({
        where: { id: item.id },
        data: {
          msrp_price: msrp,
          msrp_source: source,
          msrp_lookup_query: query,
          msrp_last_checked: new Date(),
          updated_at: new Date(),
        },
      });

      updated++;
    } else {
      console.log(`  No price found in ${results.length} results`);

      // Mark as checked so we don't re-try every run
      await prisma.items.update({
        where: { id: item.id },
        data: {
          msrp_lookup_query: query,
          msrp_last_checked: new Date(),
          updated_at: new Date(),
        },
      });

      notFound++;
    }

    console.log("");

    // Small delay between API calls to be respectful
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MSRP Lookup Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Processed:  ${items.length}`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Not found:  ${notFound}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[MSRP] Fatal error:", err);
  process.exit(1);
});
