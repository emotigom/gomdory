import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("gallery page keeps auth and URL flags behind one workshop surface", () => {
  const source = read("app", "dashboard", "gallery", "page.tsx");

  assert.match(source, /await requireUser\("\/dashboard\/gallery"\)/);
  assert.match(source, /parseFlag\(resolvedSearchParams, "tv"\)/);
  assert.match(source, /parseFlag\(resolvedSearchParams, "demo"\)/);
  assert.match(source, /data-dashboard-gallery-workshop="2"/);
  assert.match(source, /<GalleryClient tvMode=\{tvMode\} demoMode=\{demoMode\}/);
  assert.doesNotMatch(source, /DashboardPurposeHeader|statusHint|bg-slate|bg-gradient/);
});

test("gallery workshop preserves launch, demo, TV and autoplay behavior", () => {
  const source = read("app", "dashboard", "gallery", "GalleryClient.tsx");

  assert.match(source, /apiFetch\(apiV1Path\(`boards\/\$\{boardId\}\/launch`\)/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /JSON\.stringify\(\{ intent: "class", source: "gallery" \}\)/);
  assert.match(source, /router\.push\(payload\.action\.href\)/);
  assert.match(source, /const isLaunching = options\.launchingId === board\.boardId/);
  assert.match(source, /if \(launchingId !== null\) return/);
  assert.match(source, /setLaunchingId\(boardId\)/);
  assert.match(source, /setLaunchingId\(\(previous\) => \(previous === boardId \? null : previous\)\)/);
  assert.doesNotMatch(source, /useTransition|startLaunchTransition/);
  assert.match(source, /pinnedIds\.includes\(board\.boardId\)/);
  assert.match(source, /useDemoMode\(demoMode\)/);
  assert.match(source, /shouldShowDemoTiles = demoEnabled && baseTiles\.length === 0/);
  assert.match(source, /AUTOPLAY_INTERVAL_MS = 7000/);
  assert.match(source, /AUTOPLAY_PAUSE_MS = 10000/);
  assert.match(source, /galleryRootRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /enterFullscreen\(galleryRoot\)/);
  assert.doesNotMatch(source, /enterFullscreen\(document\.documentElement\)/);
  assert.match(source, /querySelector<HTMLElement>/);
  assert.match(source, /data-gallery-tile-index/);
  assert.match(source, /scrollIntoView\(\{/);
  assert.match(source, /behavior: prefersReducedMotion \? "auto" : "smooth"/);
  assert.match(source, /updateQueryFlag\("tv", next\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "f"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "d"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "a"/);
});

test("gallery copy and controls read as an exhibition desk", () => {
  const source = read("app", "dashboard", "gallery", "GalleryClient.tsx");

  assert.match(source, /data-gallery-workshop-surface/);
  assert.match(source, /작품 전시판/);
  assert.match(source, /오늘의 전시/);
  assert.match(source, /발표 화면/);
  assert.match(source, /샘플 작품/);
  assert.match(source, /자동 넘김/);
  assert.match(source, /aria-pressed=\{tvEnabled\}/);
  assert.match(source, /\{shouldShowDemoTiles \? \(/);
  assert.match(source, /baseTiles\.length === 0/);
  assert.match(source, /combinedTiles\.length > 1/);
  assert.match(source, /if \(combinedTiles\.length < 2\) setAutoplayEnabled\(false\)/);
  assert.match(source, /aria-pressed=\{autoplayEnabled\}/);
  assert.match(source, /badge: "내 보드"/);
  assert.doesNotMatch(source, /내 작품|const PALETTES|document\.documentElement/);
  assert.ok((source.match(/var\(--theme-/g) ?? []).length >= 24);
  assert.doesNotMatch(
    source,
    /Class Gallery|2\.5D Class Gallery|TV Fullscreen On|Demo Mode|CTA 전용 네비게이션|prefers-reduced-motion|Demo 카드|bg-white|text-slate|border-white|backdrop-blur|bg-gradient/,
  );
});

test("gallery cards use paper exhibits instead of glass SaaS cards", () => {
  const card = read("app", "dashboard", "gallery", "_components", "GalleryCard.tsx");
  const background = read("app", "dashboard", "gallery", "_components", "GalleryBackground.tsx");
  const grid = read("app", "dashboard", "gallery", "_components", "GalleryGrid.tsx");

  assert.match(card, /data-gallery-work-card/);
  assert.match(card, /data-gallery-tile-index=\{tileIndex\}/);
  assert.match(card, /border-2 border-\[var\(--theme-border-strong\)\]/);
  assert.match(card, /수업 기록/);
  assert.match(card, /resolveCoverToneClass\(coverTone\)/);
  assert.match(card, /usePrefersReducedMotion\(\)/);
  assert.match(card, /data-interactive="true"/);
  assert.match(card, /focus-visible:ring-\[var\(--theme-focus\)\]/);
  assert.match(background, /data-gallery-paper-background/);
  assert.match(background, /usePrefersReducedMotion\(\)/);
  assert.match(grid, /grid-cols-1/);
  assert.match(grid, /md:grid-cols-2/);
  assert.doesNotMatch(card, /rounded-3xl|backdrop-blur|bg-gradient|bg-white|text-slate|border-white/);
  assert.doesNotMatch(card, /backgroundColor: gradient|icon \?\?|[🧱🧠✨📌⭐]/u);
  assert.doesNotMatch(background, /radial-gradient|linear-gradient|backdrop-blur|bg-white|bg-slate/);
});
