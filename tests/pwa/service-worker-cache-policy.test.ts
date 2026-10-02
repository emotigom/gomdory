import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("service worker bypasses cache for _rsc and only caches ok responses", () => {
  const src = fs.readFileSync("public/sw.js", "utf8");
  assert.match(src, /url\.searchParams\.has\("_rsc"\)/);
  assert.match(src, /if \(response\.ok\)\s*\{\s*cache\.put\(request, response\.clone\(\)\)/m);
});
