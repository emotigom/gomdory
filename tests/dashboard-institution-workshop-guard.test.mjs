import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = "app/dashboard/billing/institution/page.tsx";
const clientPath = "app/dashboard/billing/institution/InstitutionPageClient.tsx";
const stylesPath = "app/dashboard/billing/institution/InstitutionPageClient.module.css";

test("institution billing opens as an adoption desk instead of another pricing card grid", async () => {
  const [page, client, styles] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(clientPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(page, /data-dashboard-institution-workshop="adoption-desk"/);
  assert.match(page, /data-dashboard-workshop-version="2"/);
  assert.match(page, /data-hud-theme-surface="institution-adoption-desk"/);
  assert.match(page, /hud-page-shell/);
  assert.match(client, /data-institution-workshop="adoption-desk"/);
  assert.match(client, /기관 도입 접수대/);
  assert.match(client, /도입 접수표/);
  assert.match(client, /학교 이용표/);
  assert.match(client, /발급 장부/);
  assert.equal((client.match(/<h1/g) ?? []).length, 1);
  assert.doesNotMatch(client, /main decision|영업일 1~2일|운영 안정성을 확인|톤으로 안내|다음 행동/);
  assert.doesNotMatch(client, /rounded-3xl|rounded-\[32px\]|bg-indigo-|text-slate-|border-amber-/);
  assert.match(styles, /box-shadow: 7px 7px 0 var\(--theme-accent\)/);
  assert.match(styles, /repeating-linear-gradient/);
  assert.match(styles, /ui-monospace/);
});

test("institution request, quote, redemption, and ops license contracts stay intact", async () => {
  const client = await readFile(clientPath, "utf8");

  for (const contract of [
    "routes.api.billing.institutionRequest()",
    "routes.api.billing.redeem()",
    "routes.api.billing.licenseList()",
    "routes.api.billing.licenseCreate()",
    'trackMarketingFunnelEvent("institution_path_view"',
    'trackMarketingFunnelEvent("institution_path_submit"',
    'trackMarketingFunnelEvent("role_selected"',
    'trackMarketingFunnelEvent("inquiry_type_selected"',
    'params.set("org_name", orgName.trim())',
    'params.set("term", term)',
    'params.set("seats", String(seats))',
    'target="_blank"',
    'rel="noreferrer"',
  ]) {
    assert.ok(client.includes(contract), `missing institution contract: ${contract}`);
  }

  for (const payloadField of [
    "org_name: orgName",
    "contact_name: contactName || null",
    "contact_email: contactEmail || null",
    "meta: { role, inquiryType, timeline }",
    "issuedTo",
    "maxUses",
    "note: adminNote",
  ]) {
    assert.ok(client.includes(payloadField), `missing request or license payload: ${payloadField}`);
  }

  assert.match(client, /if \(!opsAdmin\) return/);
  assert.match(client, /\{opsAdmin \? \(/);
  assert.match(client, /await loadLicenses\(\)/);
  assert.match(client, /getApiErrorMessage\(json,/);
  assert.match(client, /setIssuedLicenseCode\(json\.code\)/);
  assert.match(client, /navigator\.clipboard\.writeText\(issuedLicenseCode\)/);
  assert.match(client, /방금 발급한 키/);
});

test("institution desk remains theme-safe, keyboard-ready, and usable at 360px", async () => {
  const [client, styles] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(client, /aria-live="polite"/);
  assert.match(client, /role=\{toast.tone === "error" \? "alert" : "status"\}/);
  assert.match(client, /aria-label="기관 도입 순서"/);
  assert.match(client, /aria-describedby="institution-seat-unit"/);
  assert.match(client, /aria-label="발급된 기관 라이선스 목록"/);
  assert.match(client, /<form[\s\S]*onSubmit=/);
  assert.match(client, /autoComplete="organization"/);
  assert.match(client, /autoComplete="email"/);
  assert.doesNotMatch(client, /onClick=\{redeemCode\}/);

  for (const token of [
    "var(--theme-bg)",
    "var(--theme-surface)",
    "var(--theme-text)",
    "var(--theme-border-strong)",
    "var(--theme-accent)",
    "var(--theme-accent-text)",
    "var(--theme-focus)",
  ]) {
    assert.ok(styles.includes(token), `missing theme role: ${token}`);
  }

  assert.match(styles, /min-height: 3rem/);
  assert.match(styles, /@media \(max-width: 22\.5rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:global\(html\[data-theme="hud"\]\)/);
  assert.match(styles, /:global\(html\[data-gom-theme="minimal-hud"\]\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgb\(/i);
});
