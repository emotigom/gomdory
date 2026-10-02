import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const landingSource = fs.readFileSync("app/(marketing)/page.tsx", "utf8");
const hudComponentSource = fs.readFileSync("app/(marketing)/_components/MarketingHudImage.tsx", "utf8");
const registrySource = fs.readFileSync("lib/marketing/marketingHudAssets.ts", "utf8");
const statusPanelSource = fs.readFileSync("app/auth/login/_components/StatusHudPanel.tsx", "utf8");

test("marketing surfaces do not encode HUD R2 assets through _next/image", () => {
  const disallowed = "/_next/image?url=https%3A%2F%2Fassets.gomdory.com%2Fassets%2Fhud";
  const combined = `${landingSource}\n${hudComponentSource}\n${statusPanelSource}`;
  assert.equal(combined.includes(disallowed), false);
});

test("HUD marketing registry remains direct assets.gomdory.com/assets/hud URLs", () => {
  assert.equal(registrySource.includes('const MARKETING_HUD_BASE_URL = "https://assets.gomdory.com/assets/hud"'), true);
  assert.equal(registrySource.includes("/_next/image"), false);
});

test("status shell panel decorative image uses plain img and safe fallback", () => {
  [
    "<img",
    'alt=""',
    'aria-hidden="true"',
    'loading="lazy"',
    'decoding="async"',
    "draggable={false}",
    "onError={() => setHideShellPanel(true)}",
  ].forEach((token) => assert.equal(statusPanelSource.includes(token), true));
  assert.equal(statusPanelSource.includes('import Image from "next/image"'), false);
});
