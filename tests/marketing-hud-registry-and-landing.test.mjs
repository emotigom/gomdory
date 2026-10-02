import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registrySource = fs.readFileSync("lib/marketing/marketingHudAssets.ts", "utf8");
const hudComponentSource = fs.readFileSync("app/(marketing)/_components/MarketingHudImage.tsx", "utf8");
const landingSource = fs.readFileSync("app/(marketing)/page.tsx", "utf8");
const globalStylesSource = fs.readFileSync("app/globals.css", "utf8");

const slots = [
  "backgroundGrid","commandSurfaceOverlay","heroTopBar","heroRightPanel","heroActionButtonFrame","sectionFrame","cardFrame","addPanelFrame","tabStrip","coreEmblem","privacyShieldIcon","statusCircleIcon","ringFrame","squareFrame","upperFrame","crossFrame","horizontalFrame","thinHorizontalFrame","verticalFrame",
];

test("HUD asset registry is deterministic and pinned to assets.gomdory.com", () => {
  assert.equal(registrySource.includes('const MARKETING_HUD_BASE_URL = "https://assets.gomdory.com/assets/hud"'), true);
  assert.equal(registrySource.includes('const hudAsset = (path: string) => `${MARKETING_HUD_BASE_URL}/${path.replace(/^\\/+/, "")}`'), true);
  const urls = [...registrySource.matchAll(/https:\/\/assets\.gomdory\.com/g)];
  assert.ok(urls.length >= 1);
  assert.equal(/https:\/\/((?!assets\.gomdory\.com)[^\s"']+)/.test(registrySource), false);
});

test("HUD semantic slots are non-empty", () => {
  for (const slot of slots) {
    assert.equal(registrySource.includes(`${slot}:`), true);
  }
  assert.equal(registrySource.includes("export const marketingHudAssets = {"), true);
});

test("decorative HUD rendering safety defaults exist", () => {
  ["pointer-events-none", 'alt=""', 'aria-hidden="true"', "onError={() => setHidden(true)}"].forEach((k) => {
    assert.equal(hudComponentSource.includes(k), true);
  });
});

test("hero CTAs stay accessible and old branches are absent", () => {
  ["무료로 수업 열기", "학교 검토 자료 보기", "data-landing-variant=\"canonical\"", "marketing-landing-canonical"].forEach((k) => {
    assert.equal(landingSource.includes(k), true);
  });
  ["if (legacyLanding", "marketing-home-canonical-v1", "experimentalMarketingFlag"].forEach((k) => {
    assert.equal(landingSource.includes(k), false);
  });
});

test("student entry links directly to the public student domain", () => {
  const footerSource = fs.readFileSync("app/(marketing)/_components/MarketingFooter.tsx", "utf8");
  assert.equal(landingSource.includes('href={buildStudentUrl("/s")}'), true);
  assert.equal(footerSource.includes('["학생 참여", buildStudentUrl("/s")]'), true);
  assert.equal(landingSource.includes('href="/s"'), false);
});

test("canonical landing contains the current teaching-workflow preview", () => {
  [
    "수업 보드 미리보기",
    "오늘의 수업 자료",
    "작품 제출 도우미",
    "제출 현황",
    "작품 갤러리",
    "제출자 활동",
  ].forEach((k) => assert.equal(landingSource.includes(k), true));
});

test("HUD registry retains its semantic slot inventory", () => {
  const declaredSlots = [...registrySource.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]);
  assert.ok(new Set(declaredSlots).size >= slots.length);
});


test("HUD decorative layers keep pointer safety and content priority", () => {
  [
    "pointer-events-none",
    ".marketing-hud-decor",
    ".marketing-hud-surface",
    "pointer-events: none",
  ].forEach((k) => assert.equal(hudComponentSource.includes(k) || globalStylesSource.includes(k), true));
  assert.equal(landingSource.includes("relative z-10"), true);
});

test("canonical markers remain unchanged", () => {
  [
    'data-landing-variant="canonical"',
    "marketing-landing-canonical",
    "MARKETING_HOME_CANONICAL_MARKER_VERSION",
  ].forEach((k) => assert.equal(landingSource.includes(k), true));
});


test("homepage and shared HUD helpers avoid Next optimizer URLs for HUD R2 assets", () => {
  const statusPanelSource = fs.readFileSync("app/auth/login/_components/StatusHudPanel.tsx", "utf8");
  const combined = `${landingSource}
${hudComponentSource}
${statusPanelSource}`;
  assert.equal(combined.includes("/_next/image?url=https%3A%2F%2Fassets.gomdory.com%2Fassets%2Fhud"), false);
});

test("HUD registry paths stay direct R2 URLs under assets/hud", () => {
  assert.equal(registrySource.includes("MARKETING_HUD_BASE_URL"), true);
  assert.equal(registrySource.includes("https://assets.gomdory.com/assets/hud"), true);
  assert.equal(registrySource.includes("/_next/image"), false);
});

test("status shell decorative HUD image uses plain img with failure fallback", () => {
  const statusPanelSource = fs.readFileSync("app/auth/login/_components/StatusHudPanel.tsx", "utf8");
  [
    "<img",
    'alt=""',
    'aria-hidden="true"',
    'loading="lazy"',
    'decoding="async"',
    "draggable={false}",
    "onError={() => setHideShellPanel(true)}",
  ].forEach((k) => assert.equal(statusPanelSource.includes(k), true));
  assert.equal(statusPanelSource.includes('import Image from "next/image"'), false);
});
