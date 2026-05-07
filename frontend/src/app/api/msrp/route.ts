import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/msrp — Lookup MSRP for a specific item (or all items)
// Body: { itemId?: number }

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

function buildSearchQuery(item: {
  title: string;
  manufacturer: string | null;
  model_name: string | null;
  model_number: string | null;
}): string {
  const parts: string[] = [];

  if (item.manufacturer) parts.push(item.manufacturer);
  if (item.model_name) parts.push(item.model_name);
  if (item.model_number && !parts.some((p) => p.includes(item.model_number!))) {
    parts.push(item.model_number);
  }

  if (parts.length === 0) {
    const cleaned = item.title
      .replace(/^Photo Inbox:\s*/i, "")
      .replace(/^IMG\s*\d+/i, "")
      .replace(/\s*—\s*/g, " ")
      .trim();
    if (cleaned.length > 3) parts.push(cleaned);
  }

  const query = parts.join(" ").trim();
  return query ? `${query} price` : "";
}

interface ShoppingResult {
  title: string;
  price: number | null;
  source: string;
  link: string;
}

async function searchGoogleShopping(query: string): Promise<ShoppingResult[]> {
  if (!SERPAPI_KEY) return [];

  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine: "google_shopping",
    q: query,
    num: "5",
    hl: "en",
    gl: "us",
  });

  const resp = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!resp.ok) return [];

  const data = await resp.json();
  const results: ShoppingResult[] = [];

  for (const item of (data.shopping_results || []).slice(0, 5)) {
    let price: number | null = null;
    if (item.extracted_price != null) {
      price = parseFloat(String(item.extracted_price));
    } else if (item.price) {
      price = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
    }
    if (isNaN(price!)) price = null;

    results.push({
      title: item.title || "",
      price,
      source: item.source || "",
      link: item.link || item.product_link || "",
    });
  }

  return results;
}

export async function POST(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== "number" || !Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid positive integer itemId required" },
        { status: 400 }
      );
    }

    if (!SERPAPI_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "SERPAPI_KEY not configured. Get a free key at serpapi.com and add to .env",
        },
        { status: 400 }
      );
    }

    const item = await prisma.items.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    const query = buildSearchQuery({
      title: item.title,
      manufacturer: item.manufacturer,
      model_name: item.model_name,
      model_number: item.model_number,
    });

    if (!query || query === "price") {
      return NextResponse.json({
        success: false,
        error: "Not enough item metadata to build a search query. Add manufacturer/model info.",
      });
    }

    const results = await searchGoogleShopping(query);
    const prices = results.filter((r) => r.price != null && r.price > 0);

    if (prices.length === 0) {
      await prisma.items.update({
        where: { id: itemId },
        data: {
          msrp_lookup_query: query,
          msrp_last_checked: new Date(),
          updated_at: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        msrp: null,
        query,
        message: `Searched "${query}" but no prices found in ${results.length} results`,
        results: results.map((r) => ({
          title: r.title,
          price: r.price,
          source: r.source,
        })),
      });
    }

    // Compute median MSRP
    const priceValues = prices.map((r) => r.price!).sort((a, b) => a - b);
    const mid = Math.floor(priceValues.length / 2);
    const median =
      priceValues.length % 2 === 0
        ? (priceValues[mid - 1] + priceValues[mid]) / 2
        : priceValues[mid];

    const msrp = Math.round(median * 100) / 100;
    const source = prices
      .slice(0, 3)
      .map((r) => `${r.source}: $${r.price!.toFixed(2)}`)
      .join(" | ");

    await prisma.items.update({
      where: { id: itemId },
      data: {
        msrp_price: msrp,
        msrp_source: source,
        msrp_lookup_query: query,
        msrp_last_checked: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      msrp,
      query,
      source,
      results: results.map((r) => ({
        title: r.title,
        price: r.price,
        source: r.source,
      })),
    });
  } catch (error) {
    console.error("[msrp] Error:", error);
    return NextResponse.json(
      { success: false, error: "MSRP lookup failed" },
      { status: 500 }
    );
  }
}
