import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serviceOps = fs.readFileSync("docs/SERVICE_OPERATIONS.md", "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const trustDoc = fs.readFileSync("docs/TRUST_AND_COMPLIANCE.md", "utf8");
const institutionalDoc = fs.readFileSync("docs/INSTITUTIONAL_READINESS.md", "utf8");
const dataHandling = fs.readFileSync("docs/DATA_HANDLING_AND_SECURITY.md", "utf8");

test("service-operations: SERVICE_OPERATIONS.md exists and states non-contract/SLA posture", () => {
  ["정식 SLA 계약서가 아니", "현재 공개 SLA 보장은 제공하지 않습니다", "서비스 운영·장애 대응·백업 정책 v1"].forEach((k) =>
    assert.ok(serviceOps.includes(k), k)
  );
});

test("service-operations: includes incident flow and backup/restore preparing status", () => {
  ["장애 인지", "영향 범위 확인", "임시 조치 또는 우회 안내", "원인 분석", "재발 방지 항목 정리", "정식 백업/복구 정책 문서는 준비 중"].forEach((k) =>
    assert.ok(serviceOps.includes(k), k)
  );
});

test("service-operations: /school includes ops summary and avoids SLA guarantee claims", () => {
  assert.match(schoolPage, /const availableCapabilities\s*=\s*\[[^\]]*"교사 수업 보드"/);
  assert.match(schoolPage, /const plannedCapabilities\s*=\s*\[[^\]]*"기관 관리자"/);
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
  assert.ok(schoolPage.includes("{registrationCaution}"), "shared non-SLA caveat remains rendered");
  assert.ok(!schoolPage.includes("99.9% 가동률 보장"));
});

test("service-operations: trust/institution/data-handling docs link service operations doc", () => {
  [trustDoc, institutionalDoc, dataHandling].forEach((doc) => assert.ok(doc.includes("SERVICE_OPERATIONS.md")));
});

test("service-operations: docs retain explicit caveats for unprovided capabilities", () => {
  assert.match(serviceOps, /외부 보안감사 통과 증빙은 아직 공개되어 있지 않습니다/);
  assert.match(trustDoc, /보안감사, 조달 승인, 교육청 공식 인증[\s\S]*의미하지 않습니다/);
  assert.match(institutionalDoc, /## 표현 금지[\s\S]*보안감사 통과/);
  assert.match(dataHandling, /SLA 보장 문서가 아닙니다/);
});
