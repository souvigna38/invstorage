// =============================================================================
// GET /api/locate — "Where is X?" Fast Search API for Apple Shortcuts & Voice
// =============================================================================
// Designed for:
//   1. Siri / Apple Shortcuts: curl "http://<host>:3000/api/locate?q=badminton"
//   2. Home Assistant Assist / Wyoming / Piper TTS
//   3. Supports Accept: text/plain to return spoken string directly
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { semanticSearch } from "@/actions/inventory/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || searchParams.get("text") || "").trim();

    if (!query) {
      return NextResponse.json(
        {
          found: false,
          error: "Query parameter 'q' is required (e.g. /api/locate?q=badminton)",
          speech: "What item are you looking for?",
        },
        { status: 400 }
      );
    }

    // 1. Text search across items, description, and search_text
    const textMatches = await prisma.items.findMany({
      where: {
        deleted_at: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { search_text: { contains: query, mode: "insensitive" } },
          { model_name: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { asset_tag: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        locations_items_location_idTolocations: true,
        categories: true,
      },
      take: 5,
    });

    let matches = textMatches;

    // 2. If no direct text match, try semantic vector search
    if (matches.length === 0) {
      try {
        const semanticResults = await semanticSearch(query, 3);
        if (semanticResults && semanticResults.length > 0) {
          const itemIds = semanticResults.map((r) => r.item_id);
          matches = await prisma.items.findMany({
            where: { id: { in: itemIds }, deleted_at: null },
            include: {
              locations_items_location_idTolocations: true,
              categories: true,
            },
          });
        }
      } catch {
        // Fall back gracefully if vector search is unavailable
      }
    }

    const acceptHeader = request.headers.get("accept") || "";
    const wantsPlainText = acceptHeader.includes("text/plain");

    if (matches.length === 0) {
      const speech = `I couldn't find any items matching "${query}".`;
      if (wantsPlainText) {
        return new Response(speech, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return NextResponse.json({
        query,
        found: false,
        match_count: 0,
        speech,
        items: [],
      });
    }

    // Format results
    const items = matches.map((item) => {
      const location = item.locations_items_location_idTolocations;
      return {
        id: item.id,
        title: item.title,
        location: location?.name || "Unknown Location",
        address: location?.address || null,
        status: item.status || "available",
        quantity: item.quantity || 1,
        asset_tag: item.asset_tag,
      };
    });

    const topItem = items[0];
    const speech =
      items.length === 1
        ? `Your ${topItem.title} is in ${topItem.location}.`
        : `Found ${items.length} matching items. First is ${topItem.title} in ${topItem.location}.`;

    if (wantsPlainText) {
      return new Response(speech, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      query,
      found: true,
      match_count: items.length,
      speech,
      items,
    });
  } catch (error) {
    console.error("[locate] Search failed:", error);
    return NextResponse.json(
      {
        found: false,
        error: "Search failed",
        speech: "An error occurred while looking for your item.",
      },
      { status: 500 }
    );
  }
}
