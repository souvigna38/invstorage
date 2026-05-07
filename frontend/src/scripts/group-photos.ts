import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { execFileSync } from "child_process";

// =============================================================================
// Photo Grouping Preprocessor — Visual Similarity Clustering
// =============================================================================
//
// Inspired by smlr (https://github.com/LexTypeC/smlr) which uses CLIP +
// hierarchical clustering.  We reuse the same approach but call our existing
// CLIP Docker service over HTTP instead of loading a local model.
//
// Algorithm:
//   1. Scan inbox, convert HEIC→JPEG temps
//   2. Get 512-dim CLIP embedding for every photo via clip-service
//   3. Build NxN cosine-similarity matrix
//   4. Agglomerative (single-linkage) clustering with a threshold
//   5. For each cluster pick the 1–2 best photos (largest file = most detail)
//   6. Return grouping result as structured JSON
//
// Usage:
//   npx tsx src/scripts/group-photos.ts                # interactive preview
//   npx tsx src/scripts/group-photos.ts --json         # machine-readable output
//   npx tsx src/scripts/group-photos.ts --threshold 0.90
// =============================================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const HOME = process.env.HOME || "/Users/spm1";
const PHOTO_INBOX =
  process.env.PHOTO_INBOX || path.join(HOME, "Downloads", "PInventoryInbox");
const CLIP_SERVICE_URL =
  process.env.CLIP_SERVICE_URL || "http://localhost:8100";

// Similarity threshold: photos above this cosine similarity are grouped.
// 0.85 = conservative (only very similar), 0.75 = aggressive (looser match)
const DEFAULT_THRESHOLD = 0.85;

// Max photos to keep per group (primary + alternates)
const MAX_PHOTOS_PER_GROUP = 2;

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".heic", ".heif", ".tiff", ".tif", ".bmp",
]);

const NEEDS_CONVERSION = new Set([".heic", ".heif", ".tiff", ".tif", ".bmp"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface PhotoInfo {
  filePath: string;
  filename: string;
  sizeBytes: number;
  embedding: number[] | null;
}

export interface PhotoGroup {
  /** Photos selected for ingest (1–2 best quality) */
  selected: string[];
  /** Photos not selected (extras to move to processed) */
  extras: string[];
  /** All photos in this visual cluster */
  all: string[];
  /** Representative CLIP embedding (from primary photo) */
  embedding: number[] | null;
}

export interface GroupingResult {
  groups: PhotoGroup[];
  totalPhotos: number;
  totalGroups: number;
  threshold: number;
  clipAvailable: boolean;
}

// ---------------------------------------------------------------------------
// HEIC Conversion (same as ingest-photos.ts)
// ---------------------------------------------------------------------------
function convertToJpegIfNeeded(filePath: string): {
  jpegPath: string;
  needsCleanup: boolean;
} {
  const ext = path.extname(filePath).toLowerCase();
  if (!NEEDS_CONVERSION.has(ext)) {
    return { jpegPath: filePath, needsCleanup: false };
  }

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(
    tmpDir,
    `group_${crypto.randomBytes(6).toString("hex")}.jpg`
  );

  try {
    // Try macOS sips first, then Linux heif-convert (Docker/Alpine)
    // Use execFileSync to prevent shell injection via filenames
    try {
      execFileSync("sips", ["-s", "format", "jpeg", filePath, "--out", tmpFile], {
        stdio: "pipe",
      });
    } catch {
      execFileSync("heif-convert", [filePath, tmpFile, "-q", "70"], {
        stdio: "pipe",
      });
    }
    return { jpegPath: tmpFile, needsCleanup: true };
  } catch {
    return { jpegPath: filePath, needsCleanup: false };
  }
}

// ---------------------------------------------------------------------------
// CLIP Service Interaction
// ---------------------------------------------------------------------------
async function checkClipHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${CLIP_SERVICE_URL}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}

async function getClipEmbedding(filePath: string): Promise<number[] | null> {
  const { jpegPath, needsCleanup } = convertToJpegIfNeeded(filePath);
  try {
    const fileBuffer = fs.readFileSync(jpegPath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    formData.append("file", blob, path.basename(jpegPath));

    const resp = await fetch(`${CLIP_SERVICE_URL}/embed-image`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const embedding: number[] = data.embedding;
    if (!Array.isArray(embedding) || embedding.length !== 512) return null;
    return embedding;
  } catch {
    return null;
  } finally {
    if (needsCleanup && fs.existsSync(jpegPath)) {
      fs.unlinkSync(jpegPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Linear Algebra Helpers
// ---------------------------------------------------------------------------

/** Cosine similarity between two vectors (both assumed L2-normalised by CLIP). */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Agglomerative Clustering (single-linkage, ported from smlr approach)
// ---------------------------------------------------------------------------

/**
 * Simple agglomerative clustering using single-linkage and cosine similarity.
 *
 * Single-linkage: two clusters merge when ANY member of cluster A is similar
 * enough to ANY member of cluster B.  This is appropriate for our case because
 * photos of the same item from different angles may form a "chain" of
 * similarity (angle1↔angle2 = 0.90, angle2↔angle3 = 0.88) even if the
 * endpoints are less similar (angle1↔angle3 = 0.80).
 *
 * Complexity: O(N² × K) where K is merging iterations — fine for N < 200.
 */
function clusterBySimilarity(
  embeddings: (number[] | null)[],
  threshold: number
): number[] {
  const n = embeddings.length;
  // Each photo starts in its own cluster (label = index)
  const labels = Array.from({ length: n }, (_, i) => i);

  // Helper: find root label (with path compression)
  function root(i: number): number {
    while (labels[i] !== i) {
      labels[i] = labels[labels[i]]; // path compression
      i = labels[i];
    }
    return i;
  }

  // Union two labels
  function union(a: number, b: number): void {
    const ra = root(a);
    const rb = root(b);
    if (ra !== rb) {
      // Merge into the lower-numbered cluster
      if (ra < rb) labels[rb] = ra;
      else labels[ra] = rb;
    }
  }

  // Compare every pair — O(N²) but N is small (< 100 photos typically)
  for (let i = 0; i < n; i++) {
    if (!embeddings[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (!embeddings[j]) continue;
      const sim = cosineSimilarity(embeddings[i]!, embeddings[j]!);
      if (sim >= threshold) {
        union(i, j);
      }
    }
  }

  // Flatten labels so each points to its root
  for (let i = 0; i < n; i++) {
    labels[i] = root(i);
  }

  return labels;
}

// ---------------------------------------------------------------------------
// Quality Scoring — pick the best photos from a cluster
// ---------------------------------------------------------------------------

/**
 * Score a photo for quality. Higher = better.
 * We use file size as primary metric (larger HEIC/JPEG = more pixel detail).
 * This is a surprisingly good heuristic for iPhone photos where resolution
 * is constant but compression varies with scene complexity.
 */
function qualityScore(photo: PhotoInfo): number {
  return photo.sizeBytes;
}

/**
 * From a cluster of photos, select the best 1–2 to keep.
 * Returns { selected, extras } where extras will be moved to processed/.
 */
function selectBestPhotos(
  photos: PhotoInfo[],
  maxKeep: number = MAX_PHOTOS_PER_GROUP
): { selected: PhotoInfo[]; extras: PhotoInfo[] } {
  // Sort by quality descending
  const sorted = [...photos].sort((a, b) => qualityScore(b) - qualityScore(a));

  const selected = sorted.slice(0, maxKeep);
  const extras = sorted.slice(maxKeep);

  return { selected, extras };
}

// ---------------------------------------------------------------------------
// Main Grouping Logic
// ---------------------------------------------------------------------------

export async function groupPhotos(options?: {
  threshold?: number;
  verbose?: boolean;
}): Promise<GroupingResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const verbose = options?.verbose ?? false;

  // 1. Scan inbox
  if (!fs.existsSync(PHOTO_INBOX)) {
    return {
      groups: [],
      totalPhotos: 0,
      totalGroups: 0,
      threshold,
      clipAvailable: false,
    };
  }

  const files = fs.readdirSync(PHOTO_INBOX);
  const photoFiles = files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext) && !f.startsWith(".");
    })
    .sort();

  if (photoFiles.length === 0) {
    return {
      groups: [],
      totalPhotos: 0,
      totalGroups: 0,
      threshold,
      clipAvailable: false,
    };
  }

  // 2. Check CLIP
  const clipAvailable = await checkClipHealth();
  if (!clipAvailable) {
    if (verbose) console.log("[Group] CLIP not available — skipping grouping, each photo = 1 group");
    // Fall back: each photo is its own group
    const groups: PhotoGroup[] = photoFiles.map((f) => ({
      selected: [path.join(PHOTO_INBOX, f)],
      extras: [],
      all: [path.join(PHOTO_INBOX, f)],
      embedding: null,
    }));
    return {
      groups,
      totalPhotos: photoFiles.length,
      totalGroups: photoFiles.length,
      threshold,
      clipAvailable: false,
    };
  }

  // 3. Get embeddings for all photos
  if (verbose) console.log(`[Group] Getting CLIP embeddings for ${photoFiles.length} photos...`);

  const photos: PhotoInfo[] = [];
  for (let i = 0; i < photoFiles.length; i++) {
    const filename = photoFiles[i];
    const filePath = path.join(PHOTO_INBOX, filename);
    const stat = fs.statSync(filePath);
    if (verbose) {
      process.stdout.write(`  [${i + 1}/${photoFiles.length}] ${filename}...`);
    }

    const embedding = await getClipEmbedding(filePath);

    if (verbose) {
      console.log(embedding ? " ✓" : " ✗ (failed)");
    }

    photos.push({
      filePath,
      filename,
      sizeBytes: stat.size,
      embedding,
    });
  }

  // 4. Cluster by visual similarity
  if (verbose) console.log(`\n[Group] Clustering with threshold ${threshold}...`);

  const embeddings = photos.map((p) => p.embedding);
  const labels = clusterBySimilarity(embeddings, threshold);

  // 5. Collect clusters
  const clusterMap = new Map<number, number[]>(); // label → indices
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!clusterMap.has(label)) clusterMap.set(label, []);
    clusterMap.get(label)!.push(i);
  }

  // 6. For each cluster, select best photos
  const groups: PhotoGroup[] = [];
  for (const [, indices] of clusterMap) {
    const clusterPhotos = indices.map((i) => photos[i]);
    const { selected, extras } = selectBestPhotos(clusterPhotos);

    groups.push({
      selected: selected.map((p) => p.filePath),
      extras: extras.map((p) => p.filePath),
      all: clusterPhotos.map((p) => p.filePath),
      embedding: selected[0]?.embedding || null,
    });
  }

  // Sort groups: largest clusters first
  groups.sort((a, b) => b.all.length - a.all.length);

  if (verbose) {
    console.log(`\n[Group] ═══════════════════════════════════════════════════════`);
    console.log(`[Group]   Grouping Results`);
    console.log(`[Group] ═══════════════════════════════════════════════════════`);
    console.log(`[Group]   Total photos:    ${photos.length}`);
    console.log(`[Group]   Groups formed:   ${groups.length}`);
    console.log(`[Group]   Photos to keep:  ${groups.reduce((s, g) => s + g.selected.length, 0)}`);
    console.log(`[Group]   Extras to skip:  ${groups.reduce((s, g) => s + g.extras.length, 0)}`);
    console.log(`[Group]   Threshold:       ${threshold}`);
    console.log(`[Group] ═══════════════════════════════════════════════════════`);
    console.log("");

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const multi = g.all.length > 1;
      console.log(
        `  Group ${i + 1} (${g.all.length} photo${g.all.length > 1 ? "s" : ""})` +
        (multi ? " ← MERGED" : "")
      );
      for (const f of g.selected) {
        const size = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
        console.log(`    ✓ ${path.basename(f)} (${size} MB) — KEEP`);
      }
      for (const f of g.extras) {
        const size = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
        console.log(`    ✗ ${path.basename(f)} (${size} MB) — extra`);
      }
    }
    console.log("");
  }

  return {
    groups,
    totalPhotos: photos.length,
    totalGroups: groups.length,
    threshold,
    clipAvailable: true,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point (only when run directly, not when imported)
// ---------------------------------------------------------------------------
async function cliMain() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const thresholdArg = args.find((a) => a.startsWith("--threshold"));
  let threshold = DEFAULT_THRESHOLD;
  if (thresholdArg) {
    const idx = args.indexOf(thresholdArg);
    const val = parseFloat(args[idx + 1] ?? thresholdArg.split("=")[1]);
    if (!isNaN(val)) threshold = val;
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  InvStorage Photo Grouper — Visual Similarity Clustering");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Inbox:     ${PHOTO_INBOX}`);
  console.log(`  CLIP:      ${CLIP_SERVICE_URL}`);
  console.log(`  Threshold: ${threshold}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  const result = await groupPhotos({ threshold, verbose: !jsonMode });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.totalPhotos === 0) {
    console.log("[Group] No photos found in inbox.");
  }
}

// Only run CLI when this file is the direct entry point
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("group-photos");
if (isDirectRun) {
  cliMain().catch((err) => {
    console.error("[Group] Fatal error:", err);
    process.exit(1);
  });
}
