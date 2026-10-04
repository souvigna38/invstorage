// =============================================================================
// Pluggable AI Vision Client — Local Ollama + Cloud Mock Fallback
// =============================================================================
// Supports:
//   1. Local Ollama (qwen3-vl / llava) when running on local GPU hardware
//   2. Mock / Fake Vision client returning structured fixture JSON for Cloud VM / CI
//   3. Auto-detection mode (falls back to mock if Ollama is unreachable)
//
// Configurable via environment variables:
//   VISION_PROVIDER: "auto" (default) | "mock" | "ollama"
//   OLLAMA_HOST: URL of Ollama server (e.g. "http://localhost:11434" or GPU node)
//   OLLAMA_MODEL: Model name (e.g. "qwen3-vl" or "llava")
//   CLIP_PROVIDER: "auto" (default) | "mock" | "service"
//   CLIP_SERVICE_URL: URL of CLIP microservice (default "http://localhost:8100")
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { sanitizeAiLabel, type AiLabel } from "./sanitize";

export interface VisionAnalysisResult extends AiLabel {
  bin_id?: string;
  zone?: string;
  parent_container?: string;
  items_detected?: Array<{
    title: string;
    category?: string;
    quantity?: number;
    tags?: string[];
  }>;
  provider: "ollama" | "mock";
  confidence?: number;
}

export type VisionProviderMode = "auto" | "mock" | "ollama";

const VISION_PROVIDER: VisionProviderMode =
  (process.env.VISION_PROVIDER as VisionProviderMode) || "auto";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3-vl";
const CLIP_SERVICE_URL = process.env.CLIP_SERVICE_URL || "http://localhost:8100";
const CLIP_PROVIDER = (process.env.CLIP_PROVIDER || "auto").toLowerCase();

// Pre-loaded fixture database for mock mode
const FIXTURE_DIR = path.resolve(process.cwd(), "..", "fixtures", "sample_bins");

/** Load fixture JSON from disk if available */
function loadFixtureJson(name: string): Record<string, unknown> | null {
  try {
    const candidates = [
      path.join(FIXTURE_DIR, `${name}.json`),
      path.join(process.cwd(), "fixtures", "sample_bins", `${name}.json`),
      path.join(process.cwd(), "tests", "fixtures", `${name}.json`),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return JSON.parse(fs.readFileSync(cand, "utf8"));
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/** Built-in fixtures for mock mode */
const BUILTIN_FIXTURES: Record<string, VisionAnalysisResult> = {
  BIN_001: {
    bin_id: "BIN_001",
    zone: "Garage Shelf A",
    parent_container: "Garage",
    main_color: "blue",
    object_type: "storage_bin",
    detected_text: "BIN_001 YONEX BADMINTON",
    short_description:
      "Clear plastic bin labeled BIN_001 containing Yonex badminton rackets, shuttlecocks, and net.",
    items_detected: [
      {
        title: "Yonex Nanoflare 800 Badminton Racket",
        category: "Sports & Outdoors",
        quantity: 2,
        tags: ["badminton", "racket", "yonex"],
      },
      {
        title: "Yonex Aerosensa 30 Feather Shuttlecocks (Tube of 12)",
        category: "Sports & Outdoors",
        quantity: 3,
        tags: ["badminton", "birdies", "shuttlecocks"],
      },
      {
        title: "Portable Badminton Net Set",
        category: "Sports & Outdoors",
        quantity: 1,
        tags: ["badminton", "net"],
      },
    ],
    provider: "mock",
    confidence: 0.98,
  },
  BIN_002: {
    bin_id: "BIN_002",
    zone: "Workshop Wall B",
    parent_container: "Garage",
    main_color: "green",
    object_type: "hardware_case",
    detected_text: "BIN_002 NETWORK CABLES & CRIMPERS",
    short_description:
      "Green organizer case containing Cat6 patch cables, RJ45 connectors, and crimping tools.",
    items_detected: [
      {
        title: "Cat6 Snagless Ethernet Patch Cables (Pack of 5)",
        category: "Tools & Equipment",
        quantity: 5,
        tags: ["network", "cat6", "cables"],
      },
      {
        title: "Pass-Through RJ45 Modular Crimper",
        category: "Tools & Equipment",
        quantity: 1,
        tags: ["tools", "crimper", "rj45"],
      },
    ],
    provider: "mock",
    confidence: 0.96,
  },
};

/**
 * Check health of the vision subsystem.
 */
export async function checkVisionHealth(): Promise<{
  available: boolean;
  provider: "ollama" | "mock";
  model?: string;
  error?: string;
}> {
  if (VISION_PROVIDER === "mock") {
    return { available: true, provider: "mock", model: "mock-fixture-v1" };
  }

  // Attempt to ping Ollama
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];
      const hasModel = models.some(
        (m: string) => m.startsWith(OLLAMA_MODEL) || m.startsWith("llava")
      );
      if (hasModel) {
        return { available: true, provider: "ollama", model: OLLAMA_MODEL };
      }
      if (VISION_PROVIDER === "ollama") {
        return {
          available: false,
          provider: "ollama",
          error: `Model "${OLLAMA_MODEL}" not found. Available: ${models.join(", ")}`,
        };
      }
    }
  } catch (err) {
    if (VISION_PROVIDER === "ollama") {
      return {
        available: false,
        provider: "ollama",
        error: `Cannot reach Ollama at ${OLLAMA_HOST}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // If in "auto" mode and Ollama failed or model missing, fall back to mock
  if (VISION_PROVIDER === "auto") {
    return {
      available: true,
      provider: "mock",
      model: "mock-fixture-fallback",
    };
  }

  return { available: false, provider: "ollama", error: "Ollama not available" };
}

/**
 * Analyze an image with the configured or active vision client.
 */
export async function analyzeImage(
  imageInput: string | Buffer,
  options: {
    filename?: string;
    prompt?: string;
  } = {}
): Promise<VisionAnalysisResult> {
  const health = await checkVisionHealth();

  if (health.provider === "mock") {
    return mockAnalyze(imageInput, options);
  }

  return ollamaAnalyze(imageInput, options);
}

/**
 * Mock vision analyzer returning structured fixtures.
 */
function mockAnalyze(
  imageInput: string | Buffer,
  options: { filename?: string; prompt?: string } = {}
): VisionAnalysisResult {
  const searchStr = `${options.filename || ""} ${typeof imageInput === "string" ? imageInput : ""}`.toUpperCase();

  // 1. Check for specific BIN fixtures
  for (const binKey of Object.keys(BUILTIN_FIXTURES)) {
    if (searchStr.includes(binKey)) {
      const loaded = loadFixtureJson(binKey);
      if (loaded) {
        return {
          ...BUILTIN_FIXTURES[binKey],
          ...(loaded as unknown as Partial<VisionAnalysisResult>),
          provider: "mock",
        };
      }
      return BUILTIN_FIXTURES[binKey];
    }
  }

  // 2. Keyword-based realistic fixtures
  if (searchStr.includes("LAPTOP") || searchStr.includes("MACBOOK") || searchStr.includes("COMPUTER")) {
    return {
      main_color: "silver",
      object_type: "laptop",
      detected_text: "MacBook Pro Model A2991",
      short_description: "Apple MacBook Pro 16-inch laptop in space black finish with Retina display.",
      provider: "mock",
      confidence: 0.95,
    };
  }

  if (searchStr.includes("SERVER") || searchStr.includes("RACK") || searchStr.includes("POWEREDGE")) {
    return {
      main_color: "black",
      object_type: "rackmount_server",
      detected_text: "Dell PowerEdge R730xd Service Tag: JNKF732",
      short_description: "2U enterprise rackmount server with 24 2.5-inch drive bays and dual power supplies.",
      provider: "mock",
      confidence: 0.94,
    };
  }

  if (searchStr.includes("SWITCH") || searchStr.includes("NETGEAR") || searchStr.includes("CISCO")) {
    return {
      main_color: "blue",
      object_type: "network_switch",
      detected_text: "Netgear M4300-12X12F 10G Switch",
      short_description: "Managed network switch with 12 SFP+ 10G fiber ports and 12 copper ports.",
      provider: "mock",
      confidence: 0.93,
    };
  }

  // 3. Fallback generic fixture derived from filename/input
  const safeName = options.filename ? path.basename(options.filename, path.extname(options.filename)) : "item";
  return {
    main_color: "black",
    object_type: "equipment",
    detected_text: safeName.replace(/[_-]+/g, " "),
    short_description: `Inventory item: ${safeName.replace(/[_-]+/g, " ")}. Condition appears good.`,
    provider: "mock",
    confidence: 0.85,
  };
}

/**
 * Real Ollama vision analysis.
 */
async function ollamaAnalyze(
  imageInput: string | Buffer,
  options: { filename?: string; prompt?: string } = {}
): Promise<VisionAnalysisResult> {
  let base64Image: string;

  if (Buffer.isBuffer(imageInput)) {
    base64Image = imageInput.toString("base64");
  } else if (imageInput.startsWith("data:image")) {
    base64Image = imageInput.split(",")[1] || "";
  } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
    const resp = await fetch(imageInput);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    base64Image = Buffer.from(buf).toString("base64");
  } else if (fs.existsSync(imageInput)) {
    base64Image = fs.readFileSync(imageInput).toString("base64");
  } else {
    throw new Error(`Invalid image input: ${imageInput}`);
  }

  const prompt =
    options.prompt ||
    `Analyze this image for an inventory management system (WMS).
You MUST respond with ONLY valid JSON, no other text. Use this exact schema:
{
  "main_color": "dominant color of the object",
  "object_type": "category or kind of object (e.g. server, laptop, storage_bin, cable)",
  "detected_text": "any visible labels, serial numbers, bin barcodes or text",
  "short_description": "a concise 1-2 sentence description suitable for an inventory catalog",
  "bin_id": "bin or shelf identifier if visible (e.g. BIN_001), or null",
  "items": [
    { "title": "name of item", "quantity": 1 }
  ]
}`;

  const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt, images: [base64Image] }],
      stream: false,
      options: { temperature: 0.1, num_predict: 500 },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Ollama API error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const content = data.message?.content || "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      ...sanitizeAiLabel({
        main_color: "unknown",
        object_type: "unknown",
        detected_text: "",
        short_description: content.slice(0, 200),
      }),
      provider: "ollama",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const sanitized = sanitizeAiLabel(parsed);
    return {
      ...sanitized,
      bin_id: parsed.bin_id || undefined,
      items_detected: Array.isArray(parsed.items) ? parsed.items : undefined,
      provider: "ollama",
    };
  } catch {
    return {
      ...sanitizeAiLabel({
        main_color: "unknown",
        object_type: "unknown",
        detected_text: "",
        short_description: content.slice(0, 200),
      }),
      provider: "ollama",
    };
  }
}

/**
 * Generate a 512-dimensional CLIP embedding (real or mock).
 */
export async function getClipEmbedding(textOrUrl: string): Promise<number[] | null> {
  if (CLIP_PROVIDER === "mock") {
    return generateDeterministicEmbedding(textOrUrl);
  }

  // Try real service
  try {
    const isUrl = textOrUrl.startsWith("http://") || textOrUrl.startsWith("https://");
    const endpoint = isUrl ? `${CLIP_SERVICE_URL}/embed-image-url` : `${CLIP_SERVICE_URL}/embed-text`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textOrUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.embedding) && data.embedding.length === 512) {
        return data.embedding;
      }
    }
  } catch {
    // If auto mode, fall back to mock embedding
    if (CLIP_PROVIDER === "auto") {
      return generateDeterministicEmbedding(textOrUrl);
    }
  }

  return null;
}

/**
 * Generate a deterministic normalized 512-dimension float vector from a string.
 * Used in cloud tests and mock environments when CLIP service is not running.
 */
function generateDeterministicEmbedding(seed: string): number[] {
  const hash = crypto.createHash("sha256").update(seed).digest();
  const vector: number[] = new Array(512);

  let norm = 0;
  for (let i = 0; i < 512; i++) {
    const byte = hash[i % hash.length];
    // Map to [-1, 1]
    const val = (byte / 127.5 - 1.0) * Math.sin(i + 1);
    vector[i] = val;
    norm += val * val;
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 512; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}
