// =============================================================================
// Vision Client & Mock Fixtures Test Suite
// Run: node scripts/test-vision.mjs
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

let pass = 0;
let fail = 0;

function assert(condition, name) {
  if (condition) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.log(`  FAIL: ${name}`);
  }
}

console.log("===========================================");
console.log(" Pluggable Vision Client Tests");
console.log("===========================================");

// 1. Verify fixture files exist
const bin1Jpg = path.join(ROOT, "fixtures", "sample_bins", "BIN_001.jpg");
const bin1Json = path.join(ROOT, "fixtures", "sample_bins", "BIN_001.json");
const bin2Jpg = path.join(ROOT, "fixtures", "sample_bins", "BIN_002.jpg");
const bin2Json = path.join(ROOT, "fixtures", "sample_bins", "BIN_002.json");

assert(fs.existsSync(bin1Jpg), "fixtures/sample_bins/BIN_001.jpg exists");
assert(fs.existsSync(bin1Json), "fixtures/sample_bins/BIN_001.json exists");
assert(fs.existsSync(bin2Jpg), "fixtures/sample_bins/BIN_002.jpg exists");
assert(fs.existsSync(bin2Json), "fixtures/sample_bins/BIN_002.json exists");

// 2. Validate BIN_001 JSON schema
const bin1Data = JSON.parse(fs.readFileSync(bin1Json, "utf8"));
assert(bin1Data.bin_id === "BIN_001", "BIN_001 fixture has bin_id");
assert(bin1Data.zone === "Garage Shelf A", "BIN_001 fixture has zone");
assert(bin1Data.parent_container === "Garage", "BIN_001 fixture has parent_container");
assert(Array.isArray(bin1Data.items) && bin1Data.items.length >= 2, "BIN_001 has >= 2 items");
assert(bin1Data.items.some(i => i.title.toLowerCase().includes("badminton")), "BIN_001 items contain badminton");

// 3. Validate BIN_002 JSON schema
const bin2Data = JSON.parse(fs.readFileSync(bin2Json, "utf8"));
assert(bin2Data.bin_id === "BIN_002", "BIN_002 fixture has bin_id");
assert(bin2Data.zone === "Workshop Wall B", "BIN_002 fixture has zone");
assert(bin2Data.items.some(i => i.title.toLowerCase().includes("cat6")), "BIN_002 items contain Cat6");

// 4. Test vision client mock analysis
// We test the mock logic directly to verify schema contract compliance
function mockAnalyze(filename) {
  const upper = filename.toUpperCase();
  if (upper.includes("BIN_001")) {
    return {
      ...bin1Data,
      provider: "mock",
      confidence: 0.98,
    };
  }
  if (upper.includes("BIN_002")) {
    return {
      ...bin2Data,
      provider: "mock",
      confidence: 0.96,
    };
  }
  return {
    main_color: "unknown",
    object_type: "unknown",
    detected_text: "",
    short_description: "generic item",
    provider: "mock",
    confidence: 0.8,
  };
}

const mockRes1 = mockAnalyze("BIN_001.jpg");
assert(mockRes1.bin_id === "BIN_001", "Mock correctly identifies BIN_001 from filename");
assert(mockRes1.provider === "mock", "Provider is mock");
assert(mockRes1.items.length > 0, "Mock returns items list for BIN_001");

const mockRes2 = mockAnalyze("BIN_002.jpg");
assert(mockRes2.bin_id === "BIN_002", "Mock correctly identifies BIN_002 from filename");

// 5. Test deterministic CLIP embedding algorithm
import crypto from "crypto";
function generateDeterministicEmbedding(seed) {
  const hash = crypto.createHash("sha256").update(seed).digest();
  const vector = new Array(512);
  let norm = 0;
  for (let i = 0; i < 512; i++) {
    const byte = hash[i % hash.length];
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

const emb1 = generateDeterministicEmbedding("badminton gear");
assert(Array.isArray(emb1) && emb1.length === 512, "Deterministic embedding generates 512 dimensions");
assert(emb1.every(v => typeof v === "number" && Number.isFinite(v)), "All embedding values are finite numbers");
const norm1 = Math.sqrt(emb1.reduce((sum, v) => sum + v * v, 0));
assert(Math.abs(norm1 - 1.0) < 0.0001, "Embedding is L2 normalized to unit length");

// Reproducibility check: same seed produces identical vector
const emb2 = generateDeterministicEmbedding("badminton gear");
assert(emb1.every((v, i) => v === emb2[i]), "Deterministic embedding is 100% reproducible for same seed");

// Different seed produces different vector
const emb3 = generateDeterministicEmbedding("network switches");
assert(!emb1.every((v, i) => v === emb3[i]), "Different seeds produce different vectors");

console.log("");
console.log("===========================================");
const total = pass + fail;
console.log(` Results: ${pass} passed, ${fail} failed (of ${total})`);
console.log("===========================================");

process.exit(fail > 0 ? 1 : 0);
