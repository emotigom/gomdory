import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("demo gallery page exposes marker and CTA", () => {
  const filePath = path.join(process.cwd(), "app", "demo", "gallery", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes('data-page-marker="demo-gallery"'));
  assert.ok(content.includes("내 클래스 만들기"));
  assert.ok(content.includes("/auth/login?returnTo=/dashboard"));
});
