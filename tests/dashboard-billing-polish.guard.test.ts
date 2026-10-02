import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard billing pages own a dedicated interaction scope", () => {
  const billingPage = read("app", "dashboard", "billing", "page.tsx");
  const billingClient = read("app", "dashboard", "billing", "BillingPageClient.tsx");
  const institutionPage = read("app", "dashboard", "billing", "institution", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(billingPage, /data-dashboard-billing-scope/);
  assert.match(institutionPage, /data-dashboard-billing-scope/);
  assert.match(billingClient, /dashboard-billing-control/);
  assert.match(billingClient, /dashboard-billing-input/);

  assert.match(css, /\[data-dashboard-billing-scope\] \.dashboard-billing-control/);
  assert.match(css, /\[data-dashboard-billing-scope\] \.dashboard-billing-input/);
  assert.match(css, /dashboard-billing-control:focus-visible/);
  assert.match(css, /dashboard-billing-input:focus-visible/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-billing-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-billing-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
});

test("dashboard billing scope stays separate from shell, storage, board-list, and public scopes", () => {
  const css = read("app", "globals.css");
  const billingBlock = css.match(/\[data-dashboard-billing-scope\][\s\S]*?(?=\nhtml\[data-theme="hud"\] \.hud-top-chrome::before)/)?.[0] ?? "";

  assert.ok(billingBlock.length > 0, "dashboard billing CSS block should exist");
  assert.doesNotMatch(billingBlock, /data-dashboard-shell-scope|dashboard-shell-/);
  assert.doesNotMatch(billingBlock, /data-dashboard-storage-scope|dashboard-storage-/);
  assert.doesNotMatch(billingBlock, /data-dashboard-board-list-scope|dashboard-board-list-/);
  assert.doesNotMatch(billingBlock, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(billingBlock, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);
});

test("dashboard billing polish keeps route and CTA contracts visible", () => {
  const billingClient = read("app", "dashboard", "billing", "BillingPageClient.tsx");
  const institutionClient = read("app", "dashboard", "billing", "institution", "InstitutionPageClient.tsx");
  const pricing = read("app", "(marketing)", "pricing", "page.tsx");

  assert.match(billingClient, /학교·기관 도입 문의/);
  assert.match(billingClient, /개인 Pro 이용 문의/);
  assert.match(billingClient, /href="\/dashboard\/billing\/institution"/);
  assert.match(institutionClient, /접수표 보내기/);
  assert.match(institutionClient, /결재용 견적서 열기/);
  assert.match(institutionClient, /키 적용/);
  assert.match(pricing, /(?:href|ctaHref)="\/dashboard\/billing\/institution"/);
});

test("dashboard billing polish does not touch billing API, subscription, submit, or protected board files", () => {
  const protectedFiles = [
    "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
    "app/s/[code]/_components/StudentBoardMinimal.tsx",
    "app/api/v1/billing/upgrade-request/route.ts",
    "app/api/v1/billing/institution/request/route.ts",
    "app/api/v1/billing/institution/request/handler.ts",
    "app/api/v1/billing/plan/route.ts",
    "lib/billing/getUserPlan.ts",
  ];

  for (const file of protectedFiles) {
    const source = read(...file.split(path.sep));
    assert.doesNotMatch(source, /data-dashboard-billing-scope|dashboard-billing-control|dashboard-billing-input|dashboard-billing-card/);
  }
});
