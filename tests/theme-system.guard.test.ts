import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { HUD_STATUS_ASSETS } from "@/lib/theme/hudStatusAssets";

import { HUD_ASSETS } from "@/lib/theme/hudAssets";
import { HUD_ASSET_ORIGIN, HUD_ASSET_PREFIX, hudAssetUrl } from "@/lib/theme/hudAssetUrl";
import { statusLabel } from "@/lib/status/statusFormatting";

test("HUD_STATUS_ASSETS has six primary status asset keys", () => {
  assert.equal(typeof HUD_STATUS_ASSETS.commandBoard, "string");
  assert.equal(typeof HUD_STATUS_ASSETS.shellPanel, "string");
  assert.equal(typeof HUD_STATUS_ASSETS.metricsPanel, "string");
  assert.equal(typeof HUD_STATUS_ASSETS.serviceRail, "string");
  assert.equal(typeof HUD_STATUS_ASSETS.telemetryPanel, "string");
  assert.equal(typeof HUD_STATUS_ASSETS.overviewPanel, "string");
});

test("status formatting labels map to Korean labels", () => {
  assert.equal(statusLabel("operational"), "정상");
  assert.equal(statusLabel("degraded"), "성능 저하");
  assert.equal(statusLabel("partial_outage"), "부분 장애");
  assert.equal(statusLabel("major_outage"), "장애");
  assert.equal(statusLabel("maintenance"), "점검중");
  assert.equal(statusLabel("unknown"), "확인중");
});

test("status summary route source has no secret token identifiers", () => {
  const routeSource = readFileSync("app/api/status/summary/route.ts", "utf8");
  assert.equal(/service_role|SUPABASE_SERVICE|CLOUDFLARE_API|R2_SECRET|auth-token|cookie|X-Amz-Signature|X-Amz-Credential|signedUrl|uploadUrl/.test(routeSource), false);
});

test("auth login page uses StatusHudPanel", () => {
  const pageSource = readFileSync("app/auth/login/page.tsx", "utf8");
  assert.match(pageSource, /StatusHudPanel/);
});

test("globals CSS contains hud status selectors", () => {
  const cssSource = readFileSync("app/globals.css", "utf8");
  assert.match(cssSource, /\.hud-status-panel/);
  assert.match(cssSource, /\.hud-status-skeleton/);
});


test("canonical board loading skeleton uses theme primitives and avoids hardcoded light backgrounds", () => {
  const loadingSource = readFileSync("app/dashboard/boards/[boardId]/board/loading.tsx", "utf8");
  assert.match(loadingSource, /theme-skeleton-shell/);
  assert.match(loadingSource, /theme-skeleton-surface/);
  assert.match(loadingSource, /theme-skeleton-shimmer/);
  assert.equal(/bg-white|bg-stone|bg-neutral|bg-zinc-100|bg-slate-100|bg-gray-100|animate-pulse/.test(loadingSource), false);
});


test("hud asset URL helper and manifests use canonical prefix", () => {
  assert.equal(HUD_ASSET_ORIGIN, "https://assets.gomdory.com");
  assert.equal(HUD_ASSET_PREFIX, "/assets/hud");
  assert.equal(hudAssetUrl("hud-top-bar.png"), "https://assets.gomdory.com/assets/hud/hud-top-bar.png");
  assert.match(HUD_ASSETS.dashboard.topBar, /^https:\/\/assets\.gomdory\.com\/assets\/hud\//);
  assert.match(HUD_STATUS_ASSETS.shellPanel, /^https:\/\/assets\.gomdory\.com\/assets\/hud\/status\//);

  const flatten = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (!value || typeof value !== "object") return [];
    return Object.values(value as Record<string, unknown>).flatMap(flatten);
  };

  for (const assetPath of [...flatten(HUD_ASSETS), ...flatten(HUD_STATUS_ASSETS)]) {
    assert.equal(assetPath.includes("/gom/assets/hud"), false);
    assert.equal(assetPath.includes("www.gomdory.com/gom/assets"), false);
  }
});

test("globals.css has no app-relative HUD URL references", () => {
  const cssSource = readFileSync("app/globals.css", "utf8");
  assert.equal(cssSource.includes('url("/gom/assets/hud'), false);
  assert.equal(cssSource.includes("url('/gom/assets/hud"), false);
});
