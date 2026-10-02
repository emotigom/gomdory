import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const publicRoute = fs.readFileSync("app/w/[slug]/page.tsx", "utf8");

test("public route hides unpublished content", () => {
  assert.match(publicRoute, /published\.status !== "published"/);
  assert.match(publicRoute, /notFound\(\)/);
  assert.doesNotMatch(publicRoute, /JSON\.stringify\(published\)|console\.log\(published\)/);
});
