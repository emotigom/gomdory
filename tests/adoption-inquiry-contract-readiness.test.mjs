import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findUnverifiedCompletionClaims } from "./helpers/markdown-unverified-claims.mjs";

const docPath = "docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md";
const doc = fs.readFileSync(docPath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const linkDocs = [
  "docs/TRUST_AND_COMPLIANCE.md",
  "docs/INSTITUTIONAL_READINESS.md",
  "docs/DATA_HANDLING_AND_SECURITY.md",
  "docs/SERVICE_OPERATIONS.md",
  "docs/API_AND_INTEGRATIONS.md",
  "docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md",
  "docs/ORGANIZATION_ADMIN_MODEL.md",
];

test("adoption inquiry contract readiness doc exists", () => {
  assert.ok(fs.existsSync(docPath));
});

test("doc clearly states it is not procurement approval/contract guarantee", () => {
  ["조달 승인", "계약 보장", "가격 확정"].forEach((k) => assert.ok(doc.includes(k), k));
});

test("doc lists institutional review materials", () => {
  [
    "/school",
    "docs/INSTITUTIONAL_READINESS.md",
    "docs/TRUST_AND_COMPLIANCE.md",
    "docs/DATA_HANDLING_AND_SECURITY.md",
    "docs/SERVICE_OPERATIONS.md",
    "docs/API_AND_INTEGRATIONS.md",
    "docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md",
    "docs/ORGANIZATION_ADMIN_MODEL.md",
    "docs/LESSON_CONTENT_PRIVACY.md",
  ].forEach((k) => assert.ok(doc.includes(k), k));
});

test("doc lists inquiry input information and avoids requesting student personal info", () => {
  ["기관 유형", "교사 수", "학생 수", "희망 파일럿 기간", "조달 관련 문서 필요 여부"].forEach((k) => assert.ok(doc.includes(k), k));
  assert.ok(doc.includes("학생 개인식별정보"));
  assert.ok(doc.includes("요청하지 않습니다"));
});

test("doc lists preparing items like quote/contract/invoice/SLA/audit evidence", () => {
  ["견적서 양식", "계약서/이용 신청서 양식", "세금계산서 발행/처리 워크플로우", "정식 SLA 문서", "외부 보안감사/보안검토 증빙"].forEach(
    (k) => assert.ok(doc.includes(k), k),
  );
});

const unverifiedCompletionPhrases = ["조달 등록 완료", "학교 납품 가능", "보안감사 통과", "SLA 보장", "세금계산서 발행 가능", "계약 즉시 가능"];

test("doc does not claim unverified completion outside wording guardrails", () => {
  ["표현 주의 사항", "검증 전 금지 표현"].forEach((k) => assert.ok(doc.includes(k), k));
  assert.deepEqual(findUnverifiedCompletionClaims(doc, unverifiedCompletionPhrases), []);
});

test("markdown unverified completion claim helper tracks warning and denial context", () => {
  const allowed = `## 표현 주의 사항\n조달 등록 완료\n\n## 안내\n검증 전 금지 표현:\n보안감사 통과\n\n본 문서는 조달 승인 문서가 아닙니다.`;
  assert.deepEqual(findUnverifiedCompletionClaims(allowed, unverifiedCompletionPhrases), []);

  const blocked = `## 현재 상태\n조달 등록 완료\n보안감사 통과\nSLA 보장\n세금계산서 발행 가능\n계약 즉시 가능`;
  assert.deepEqual(
    findUnverifiedCompletionClaims(blocked, unverifiedCompletionPhrases).map(({ phrase }) => phrase),
    ["조달 등록 완료", "보안감사 통과", "SLA 보장", "세금계산서 발행 가능", "계약 즉시 가능"],
  );
});

test("school page references adoption inquiry and quotation readiness", () => {
  ["도입 문의·견적 준비 현황", "견적서, 계약서, 세금계산서, 조달 관련 자료는", "준비 중입니다"].forEach((k) =>
    assert.ok(schoolPage.includes(k), k),
  );
});

test("core trust/institution/data/api/workspace/org-admin docs link to new doc", () => {
  linkDocs.forEach((path) => {
    const content = fs.readFileSync(path, "utf8");
    assert.ok(content.includes("docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md"), path);
  });
});

test("no billing/payment code or db migration changes required in this scope", () => {
  assert.ok(doc.includes("본 문서는"));
  assert.ok(doc.includes("문의"));
});
