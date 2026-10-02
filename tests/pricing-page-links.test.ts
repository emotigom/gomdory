import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const source = readFileSync("app/(marketing)/pricing/page.tsx", "utf8");

test("primary pricing CTAs point to expected routes", () => {
  assert.match(source, /href="\/auth\/login\?mode=signup"/);
  assert.match(source, /href="\/dashboard\/billing\?intent=demo#upgrade"/);
  assert.match(source, /(?:href|ctaHref)="\/dashboard\/billing\/institution"/);
  assert.match(source, /href="\/school"/);

  assert.ok(existsSync("app/auth/login/page.tsx"), "signup CTA route must exist");
  assert.ok(existsSync("app/dashboard/billing/page.tsx"), "Pro inquiry CTA route must exist");
  assert.ok(existsSync("app/dashboard/billing/institution/page.tsx"), "institution inquiry CTA route must exist");
  assert.ok(existsSync("app/(marketing)/school/page.tsx"), "school review-material route must exist");
  assert.doesNotMatch(source, /github\.com\/[^"']*gom-clean\/blob\/main\/docs/);
});

test("pricing page keeps required compliance and legal text", () => {
  const layoutSource = readFileSync("app/(marketing)/_components/MarketingFooter.tsx", "utf8");
  assert.match(layoutSource, /개인정보처리방침/);
  assert.match(layoutSource, /이용약관/);
  assert.match(layoutSource, /학생 개인정보 보호 안내/);
  assert.match(layoutSource, /학습지원 SW 기준 안내/);
  assert.match(layoutSource, /학교 에듀집 검토 안내/);
});
