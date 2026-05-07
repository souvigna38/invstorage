import { NextResponse } from "next/server";
import { mergeItems } from "@/actions/inventory";
import { requireAuth } from "@/lib/auth";

// POST /api/merge — merge selected items
export async function POST(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { itemIds } = body;

    if (!Array.isArray(itemIds) || itemIds.length < 2 || !itemIds.every((id: unknown) => typeof id === "number" && Number.isInteger(id) && id > 0)) {
      return NextResponse.json(
        { success: false, error: "Need at least 2 valid positive integer item IDs" },
        { status: 400 }
      );
    }

    const result = await mergeItems(itemIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[merge] Error:", error);
    return NextResponse.json(
      { success: false, error: "Merge failed" },
      { status: 500 }
    );
  }
}
