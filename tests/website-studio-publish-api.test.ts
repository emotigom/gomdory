import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("publish api route exists", () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "api", "website-studio", "publish", "route.ts")), true);
});

test("publish payload avoids raw llm fields", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");
  assert.equal(/prompt(Text)?\s*:/i.test(source), false);
  assert.equal(/rawResponse|modelResponse/i.test(source), false);
});
