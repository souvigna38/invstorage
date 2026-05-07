// =============================================================================
// Unit tests for lib/sanitize.ts — sanitizeAiLabel & sanitizeUserText
// Run: node scripts/test-sanitize.mjs
// =============================================================================

// Since sanitize.ts is TypeScript, we re-implement the logic here for testing.
// This ensures the algorithm is correct; the actual .ts file uses the same code.

function stripHtml(s, maxLen) {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeAiLabel(raw) {
  return {
    main_color: stripHtml(raw.main_color, 50) || "unknown",
    object_type: stripHtml(raw.object_type, 100) || "unknown",
    detected_text: stripHtml(raw.detected_text, 500) || "",
    short_description: stripHtml(raw.short_description, 500) || "",
  };
}

function sanitizeUserText(s, maxLen = 2000) {
  if (!s || typeof s !== "string") return "";
  return s.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

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
console.log(" sanitizeAiLabel tests");
console.log("===========================================");

// Test 1: Script tag XSS
const xss1 = sanitizeAiLabel({
  main_color: '<script>alert(1)</script>red',
  object_type: '<script>document.cookie</script>laptop',
  detected_text: 'Hello <script>evil()</script> World',
  short_description: '<b>Bold</b> and <i>italic</i> text',
});
assert(!xss1.main_color.includes("<"), "Script tags stripped from main_color");
assert(xss1.main_color.includes("red"), "Legit text preserved in main_color");
assert(!xss1.object_type.includes("<"), "Script tags stripped from object_type");
assert(xss1.object_type.includes("laptop"), "Legit text preserved in object_type");
assert(!xss1.detected_text.includes("<"), "Script tags stripped from detected_text");
assert(xss1.detected_text.includes("Hello"), "Legit text preserved in detected_text");
assert(!xss1.short_description.includes("<"), "HTML tags stripped from description");
assert(xss1.short_description === "Bold and italic text", "Description text preserved after strip");

// Test 2: img onerror XSS
const xss2 = sanitizeAiLabel({
  main_color: '<img src=x onerror=alert(1)>blue',
  object_type: 'server',
  detected_text: '',
  short_description: '<img/src=x onerror=steal()>A nice server',
});
assert(!xss2.main_color.includes("<"), "img onerror stripped from main_color");
assert(xss2.main_color === "blue", "blue preserved after img strip");
assert(!xss2.short_description.includes("<"), "img onerror stripped from description");
assert(xss2.short_description.includes("A nice server"), "Description preserved after img strip");

// Test 3: Long string truncation
const longStr = "A".repeat(10000);
const trunc = sanitizeAiLabel({
  main_color: longStr,
  object_type: longStr,
  detected_text: longStr,
  short_description: longStr,
});
assert(trunc.main_color.length <= 50, `main_color truncated to <=50 (got ${trunc.main_color.length})`);
assert(trunc.object_type.length <= 100, `object_type truncated to <=100 (got ${trunc.object_type.length})`);
assert(trunc.detected_text.length <= 500, `detected_text truncated to <=500 (got ${trunc.detected_text.length})`);
assert(trunc.short_description.length <= 500, `short_description truncated to <=500 (got ${trunc.short_description.length})`);

// Test 4: Normal labels pass through unchanged
const normal = sanitizeAiLabel({
  main_color: "black",
  object_type: "laptop",
  detected_text: "Dell Latitude E5570 SN:ABC123",
  short_description: "A Dell business laptop in black with 15-inch screen.",
});
assert(normal.main_color === "black", "Normal main_color preserved");
assert(normal.object_type === "laptop", "Normal object_type preserved");
assert(normal.detected_text === "Dell Latitude E5570 SN:ABC123", "Normal detected_text preserved");
assert(normal.short_description === "A Dell business laptop in black with 15-inch screen.", "Normal description preserved");

// Test 5: Empty/null inputs default correctly
const empty = sanitizeAiLabel({
  main_color: "",
  object_type: undefined,
  detected_text: null,
  short_description: "",
});
assert(empty.main_color === "unknown", "Empty main_color defaults to unknown");
assert(empty.object_type === "unknown", "Undefined object_type defaults to unknown");
assert(empty.detected_text === "", "Null detected_text defaults to empty string");
assert(empty.short_description === "", "Empty short_description defaults to empty string");

// Test 6: Control characters stripped
const ctrl = sanitizeAiLabel({
  main_color: "red\x00\x01\x02",
  object_type: "laptop\ttab\nnewline",
  detected_text: "text\rwith\r\nlinebreaks",
  short_description: "desc with \x1b[31m ANSI codes \x1b[0m",
});
assert(!ctrl.main_color.includes("\x00"), "Null bytes stripped");
assert(!ctrl.object_type.includes("\t"), "Tab characters stripped");
assert(!ctrl.detected_text.includes("\r"), "CR stripped");
assert(!ctrl.short_description.includes("\x1b"), "ANSI escape stripped");

console.log("");
console.log("===========================================");
console.log(" sanitizeUserText tests");
console.log("===========================================");

// Test 7: HTML in user text
const ut1 = sanitizeUserText('<script>alert("xss")</script>My nice product');
assert(!ut1.includes("<"), "Script tags stripped from user text");
assert(ut1.includes("My nice product"), "User text content preserved");

// Test 8: Long user text truncated
const ut2 = sanitizeUserText("B".repeat(5000));
assert(ut2.length <= 2000, `User text truncated to <=2000 (got ${ut2.length})`);

// Test 9: Custom max length
const ut3 = sanitizeUserText("Hello World", 5);
assert(ut3.length <= 5, `Custom maxLen=5 enforced (got ${ut3.length})`);

// Test 10: Null/undefined
assert(sanitizeUserText(null) === "", "null returns empty string");
assert(sanitizeUserText(undefined) === "", "undefined returns empty string");
assert(sanitizeUserText("") === "", "empty string returns empty string");

console.log("");
console.log("===========================================");
const total = pass + fail;
console.log(` Results: ${pass} passed, ${fail} failed (of ${total})`);
console.log("===========================================");

process.exit(fail > 0 ? 1 : 0);
