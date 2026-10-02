import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("website studio r2 assets are centralized", () => {
  const source = fs.readFileSync("lib/website-studio/websiteStudioGlassAssets.ts", "utf8");
  assert.match(source, /WEBSITE_STUDIO_GLASS_ASSET_MANIFEST_URL/);
  assert.match(source, /assets\.gomdory\.com\/assets\/website-studio\/glass\/v1/);
  assert.match(source, /shellFrame/);
  assert.match(source, /previewFrame/);
});

test("shellFrame is decorative and non-interactive", () => {
  const source = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioGlassSurface.tsx", "utf8");
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /alt=""/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /slot="shellFrame" className="opacity-12"/);
});
