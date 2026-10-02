import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "app", "dashboard", "websites", "new", "page.tsx");
const starterPath = path.join(process.cwd(), "app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");
const shellPath = path.join(process.cwd(), "app", "dashboard", "websites", "_components", "WebsiteStudioGlassSurface.tsx");

test("starter route keeps glass theme and section separation", () => {
  const starterSource = fs.readFileSync(starterPath, "utf8");
  const shellSource = fs.readFileSync(shellPath, "utf8");

  assert.match(shellSource, /data-website-studio-theme="glass"/);
  assert.match(starterSource, /<h2[^>]*>이어서 만들기<\/h2>/);
  assert.match(starterSource, /<h2[^>]*>새로 시작하기<\/h2>/);
  assert.match(starterSource, /아직 이어서 만들 초안이 없습니다\./);
  assert.match(starterSource, /이 템플릿으로 시작/);
});

test("starter hub uses premium dark page background", () => {
  const pageSource = fs.readFileSync(pagePath, "utf8");
  assert.match(pageSource, /radial-gradient/);
  assert.match(pageSource, /linear-gradient/);
});
