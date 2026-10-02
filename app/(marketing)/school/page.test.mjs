import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const adoptionReadinessPage = fs.readFileSync("app/(marketing)/school/adoption-readiness/page.tsx", "utf8");
const footer = fs.readFileSync("app/(marketing)/_components/MarketingFooter.tsx", "utf8");
const institutionalDoc = fs.readFileSync("docs/INSTITUTIONAL_READINESS.md", "utf8");

test("institutional readiness page exists with core registration wording", () => {
  ["에듀집", "한국디지털교육협회", "학습지원 소프트웨어"].forEach((k) => assert.ok(page.includes(k), k));
});

test("institutional page includes caution and avoids overclaim", () => {
  assert.ok(page.includes("registrationCaution"));
  assert.match(page, /외부 인증이나 심의 통과를 뜻하지 않(?:으며|습니다)/);
  assert.ok(page.includes("{registrationCaution}"), "shared registration caveat remains rendered");
  ["보안감사 통과", "조달 승인", "교육청 인증", "SLA 보장"].forEach((k) => assert.ok(!page.includes(k), k));
});

test("footer links institutional readiness page", () => {
  assert.match(footer, /<Link\b[^>]*href="\/school"[^>]*>[^<]*학교[^<]*<\/Link>/, "school review link remains labelled and reachable");
});

test("institutional docs include roadmap", () => {
  ["준비 로드맵", "사업자등록번호 공개", "공식 API 문서", "Google Workspace 연동 / 로스터 동기화"].forEach((k) => assert.ok(institutionalDoc.includes(k), k));
});

test("school page links adoption readiness to a public internal route", () => {
  assert.ok(page.includes('href="/school/adoption-readiness"'));
  assert.ok(!page.includes("github.com/gkrry"));
  assert.ok(!page.includes("gom-clean/blob/main/docs"));
});

test("adoption readiness page uses public-safe summary copy", () => {
  assert.ok(adoptionReadinessPage.includes("조달 승인, 계약 보장, 가격 확정, 견적 확약을 뜻하지 않습니다"));
  assert.ok(adoptionReadinessPage.includes('href="/contact"'));
  assert.ok(!adoptionReadinessPage.includes("github.com/gkrry"));
  assert.ok(!adoptionReadinessPage.includes("gom-clean/blob/main/docs"));
});
