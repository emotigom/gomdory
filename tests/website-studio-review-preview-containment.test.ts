import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const reviewSource = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");
const previewSource = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "_components", "WebsiteStudioPreviewFrame.tsx"), "utf8");

test("review preview panel and iframe are visually contained and sandboxed", () => {
  assert.match(reviewSource, /max-w-full overflow-hidden/);
  assert.match(previewSource, /max-w-full overflow-hidden/);
  assert.match(previewSource, /className="block h-\[clamp\(320px,52vh,560px\)\] w-full max-w-full/);
  assert.doesNotMatch(previewSource, /100vw/);
  assert.doesNotMatch(previewSource, /allow-scripts/);
});
