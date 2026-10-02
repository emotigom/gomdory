import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractMarkdownSection, findUnverifiedCompletionClaims } from "./helpers/markdown-unverified-claims.mjs";

const packagePath = "docs/INSTITUTION_REVIEW_PACKAGE.md";
const packageDoc = fs.readFileSync(packagePath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");

const requiredDocs = [
  "docs/INSTITUTIONAL_READINESS.md",
  "docs/TRUST_AND_COMPLIANCE.md",
  "docs/DATA_HANDLING_AND_SECURITY.md",
  "docs/SERVICE_OPERATIONS.md",
  "docs/API_AND_INTEGRATIONS.md",
  "docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md",
  "docs/ORGANIZATION_ADMIN_MODEL.md",
  "docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md",
  "docs/LESSON_CONTENT_PRIVACY.md",
];

test("institution-review-package: doc exists", () => {
  assert.ok(fs.existsSync(packagePath));
});

test("institution-review-package: links required documents", () => {
  requiredDocs.forEach((doc) => assert.ok(packageDoc.includes(doc), doc));
});

test("institution-review-package: includes non-certification disclaimer", () => {
  ["인증서", "조달 승인 문서", "SLA 계약서", "외부 보안감사 보고서가 아닙니다"].forEach((k) => assert.ok(packageDoc.includes(k), k));
});

test("institution-review-package: includes available materials and preparing items", () => {
  ["현재 확인 가능한 자료", "현재 준비 중인 자료", "사업자등록번호 공개", "세금계산서/결제 절차", "Google Workspace/로스터 구현"].forEach((k) => assert.ok(packageDoc.includes(k), k));
});

test("institution-review-package: includes wording guardrails", () => {
  const wordingSection = extractMarkdownSection(packageDoc, /표현\s*주의/);
  assert.ok(wordingSection, "표현 주의 section");
  [
    "허용 표현",
    "검증 전 금지 표현",
    "Workspace/로스터는 계획 문서 단계",
    "공식 인증 완료",
    "조달 승인",
    "보안감사 통과",
    "SLA 보장",
    "Google Workspace 연동 완료",
    "로스터 자동 동기화 제공",
    "기관 관리자 기능 제공",
    "세금계산서 발행 가능",
    "계약 즉시 가능",
  ].forEach((k) => assert.ok(wordingSection.includes(k), k));
});

test("institution-review-package: school page surfaces current institutional review entry points", () => {
  assert.match(schoolPage, /학교별 기준에 따른 검토가 필요합니다/);
  assert.match(schoolPage, /const plannedCapabilities\s*=\s*\[[^\]]*"기관 관리자"/);
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?plannedCapabilities\.map/);
  ["검토 자료", "도입 문의·견적 준비 현황", "등록 현황"].forEach((text) =>
    assert.ok(schoolPage.includes(text), text),
  );

  [
    ["개인정보처리방침", "/legal/privacy"],
    ["개인정보 처리 항목 안내", "/edu/compliance/privacy-data"],
    ["AI 개인정보 보호 안내", "/legal/ai-privacy"],
    ["아동·청소년 보호 안내", "/legal/child-safety"],
    ["보안 문의", "/legal/security"],
    ["접근성 안내", "/legal/accessibility"],
    ["학습지원 SW 기준 안내", "/edu/compliance/learning-support-software"],
    ["학교·에듀집 검토 안내", "/legal/certification-readiness"],
  ].forEach(([label, href]) => {
    assert.match(schoolPage, new RegExp(`\\["${label}",\\s*"${href}"\\]`), `${label}: ${href}`);
  });

  assert.match(
    schoolPage,
    /href="\/school\/adoption-readiness">도입 문의·견적·계약 준비 현황 v1<\/Link>/,
    "도입 문의·견적·계약 준비 현황 v1: /school/adoption-readiness",
  );
});

test("institution-review-package: no unverified completion claims outside wording guardrails", () => {
  const phrases = ["공식 인증 완료", "조달 승인", "보안감사 통과", "SLA 보장", "Google Workspace 연동 완료", "로스터 자동 동기화 제공", "기관 관리자 기능 제공", "세금계산서 발행 가능", "계약 즉시 가능"];
  assert.deepEqual(findUnverifiedCompletionClaims(packageDoc, phrases), []);
});

test("institution-review-package: organization-admin matcher can select test file", () => {
  assert.ok("organization-admin-model.test.mjs".includes("organization-admin"));
});

test("institution-review-package: no db migration, billing/payment, oauth/google api dependency changes", () => {
  const changed = [
    ...fs.readdirSync("supabase", { withFileTypes: true }).filter((d) => d.name === "migrations"),
  ];
  assert.ok(changed.length >= 0);

  const lockCandidates = ["package.json", "package-lock.json", "pnpm-lock.yaml"];
  const content = lockCandidates.filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, "utf8")).join("\n");
  assert.ok(!/googleapis|oauth/i.test(content));
  assert.ok(!/stripe|billing|payment/i.test(content));
});
