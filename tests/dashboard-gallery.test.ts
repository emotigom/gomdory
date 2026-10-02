import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("dashboard gallery page exposes page marker", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "gallery", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-page-marker="dashboard-gallery"'));
});

test("gallery cards keep CTA-only navigation", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "gallery", "_components", "GalleryCard.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes("<article"));
  assert.ok(!content.match(/<article[^>]*onClick=/));
  assert.ok(content.includes('data-interactive="true"'));
});
