import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("exhibit page exposes page marker", () => {
  const pagePath = path.join(process.cwd(), "app", "e", "[token]", "page.tsx");
  const content = fs.readFileSync(pagePath, "utf8");
  assert.ok(content.includes('data-page-marker="exhibit"'));
});
