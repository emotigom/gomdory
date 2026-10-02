import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("app/dashboard/billing/BillingPageClient.tsx", "utf8");
const styles = readFileSync("app/dashboard/billing/BillingPageClient.module.css", "utf8");
const page = readFileSync("app/dashboard/billing/page.tsx", "utf8");
const successPage = readFileSync("app/dashboard/billing/success/page.tsx", "utf8");
const successStyles = readFileSync("app/dashboard/billing/success/BillingSuccess.module.css", "utf8");

test("billing keeps the plan, storage, feature flag, and inquiry contracts", () => {
  for (const token of [
    "plan.isPro",
    "limits.proLimitBytes",
    "limits.freeLimitBytes",
    "usage.usedBytes",
    "proEnabled",
    "routes.api.billing.upgradeRequest()",
    'method: "POST"',
    'window.location.href = "/auth/login?returnTo=/dashboard/billing#upgrade"',
    'requestIntent === "org"',
    "trackMarketingFunnelEvent",
    'limitBytes === 0 ? "현재 저장 용량이 열려 있지 않아요.',
    '"저장공간 사용 중지"',
  ]) {
    assert.match(client, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing billing contract: ${token}`);
  }
});

test("billing is a workshop pass and capacity instrument, not a generic SaaS card stack", () => {
  assert.match(client, /내 이용표/);
  assert.match(client, /용량 계기판/);
  assert.match(client, /<meter/);
  assert.match(client, /이용 내역/);
  assert.match(styles, /box-shadow:\s*6px 6px 0/);
  assert.match(styles, /border-radius:\s*0/);
  assert.doesNotMatch(client, /rounded-\[32px\]|rounded-3xl|backdrop-blur|bg-\[linear-gradient/);
});

test("billing modal keeps keyboard, focus restoration, and live feedback", () => {
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /event\.key !== "Tab"/);
  assert.match(client, /<form[\s\S]*onSubmit=/);
  assert.match(client, /<button type="submit"/);
  assert.match(client, /previouslyFocused\?\.focus\(\)/);
  assert.match(client, /role="alert"/);
  assert.match(client, /aria-live="polite"/);
  assert.match(styles, /min-height:\s*44px/);
});

test("billing follows dashboard theme roles and keeps OLD HUD treatment", () => {
  assert.match(page, /data-dashboard-billing-scope/);
  for (const token of ["--theme-bg", "--theme-card", "--theme-text", "--theme-accent", "--theme-focus"]) {
    assert.match(styles, new RegExp(token), `missing theme role: ${token}`);
  }
  assert.match(styles, /html\[data-theme="hud"\]/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("billing success uses a verified workshop receipt instead of a generic completion card", () => {
  assert.match(successPage, /결제 확인 전표/);
  assert.match(successPage, /확인 표가 도착하고 있어요/);
  assert.match(successPage, /Pro 작업칸이 열렸어요/);
  assert.match(successPage, /data-billing-verification=/);
  assert.match(successStyles, /box-shadow:\s*8px 8px 0/);
  assert.match(successStyles, /html\[data-theme="hud"\]/);
  assert.match(successStyles, /prefers-reduced-motion/);
  assert.doesNotMatch(successPage, /rounded-xl|rounded-3xl|bg-\[linear-gradient/);
});
