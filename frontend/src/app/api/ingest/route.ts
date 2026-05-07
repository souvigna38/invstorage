import { NextResponse } from "next/server";
import { spawn } from "child_process";
import * as path from "path";
import { requireAuth } from "@/lib/auth";

// Use the local tsx binary for fast startup
const TSX_BIN = path.join(process.cwd(), "node_modules", ".bin", "tsx");
const SCRIPT = path.join(process.cwd(), "src", "scripts", "ingest-photos.ts");

/** Run the ingest script and collect output via spawn. */
function runIngest(args: string[] = []): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const child = spawn(TSX_BIN, [SCRIPT, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600_000, // 10 min max (grouping + ingest for large batches)
    });

    child.stdout.on("data", (data: Buffer) => chunks.push(data.toString()));
    child.stderr.on("data", (data: Buffer) => chunks.push(data.toString()));

    child.on("close", (code: number | null) => {
      resolve({ code: code ?? 1, output: chunks.join("") });
    });

    child.on("error", (err: Error) => {
      resolve({ code: 1, output: err.message });
    });
  });
}

// POST /api/ingest — triggers the grouped photo ingest pipeline
export async function POST(request: Request) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    const { code, output } = await runIngest();

    // Parse the v2 (grouped) output format
    const noPhotos = output.includes("No photos found in inbox");
    const photosMatch = output.match(/Photos scanned:\s+(\d+)/);
    const groupsMatch = output.match(/Groups formed:\s+(\d+)/);
    const itemsMatch = output.match(/Items created:\s+(\d+)/);
    const imagesMatch = output.match(/Images uploaded:\s+(\d+)/);
    const vectorizedMatch = output.match(/Vectorized:\s+(\d+)/);
    const labeledMatch = output.match(/AI Labeled:\s+(\d+)/);
    const dedupedMatch = output.match(/De-duped extras:\s+(\d+)/);
    const exactDupMatch = output.match(/Skipping (\d+) exact duplicate/);

    return NextResponse.json({
      success: code === 0,
      noPhotos,
      photosScanned: photosMatch ? parseInt(photosMatch[1]) : 0,
      groupsFormed: groupsMatch ? parseInt(groupsMatch[1]) : 0,
      itemsCreated: itemsMatch ? parseInt(itemsMatch[1]) : 0,
      imagesUploaded: imagesMatch ? parseInt(imagesMatch[1]) : 0,
      vectorized: vectorizedMatch ? parseInt(vectorizedMatch[1]) : 0,
      labeled: labeledMatch ? parseInt(labeledMatch[1]) : 0,
      similarMerged: dedupedMatch ? parseInt(dedupedMatch[1]) : 0,
      exactDuplicatesSkipped: exactDupMatch ? parseInt(exactDupMatch[1]) : 0,
      output,
    });
  } catch (error) {
    console.error("[API /ingest] Error:", error);
    return NextResponse.json(
      { success: false, error: "Ingest failed" },
      { status: 500 }
    );
  }
}

// GET /api/ingest — quick check for pending photos
export async function GET() {
  try {
    const { output } = await runIngest(["--dry-run"]);

    const countMatch = output.match(/(\d+) unique photo/);
    const groupMatch = output.match(/Groups formed:\s+(\d+)/);
    const noPhotos = output.includes("No photos found");

    return NextResponse.json({
      pending: noPhotos ? 0 : (countMatch ? parseInt(countMatch[1]) : 0),
      groups: groupMatch ? parseInt(groupMatch[1]) : 0,
    });
  } catch {
    return NextResponse.json({ pending: 0, groups: 0 });
  }
}
