import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiDocPath = "docs/API_AND_INTEGRATIONS.md";
const apiDoc = fs.readFileSync(apiDocPath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");

const trustDocs = [
  "docs/INSTITUTIONAL_READINESS.md",
  "docs/TRUST_AND_COMPLIANCE.md",
  "docs/DATA_HANDLING_AND_SECURITY.md",
  "docs/SERVICE_OPERATIONS.md",
];

test("API_AND_INTEGRATIONS doc exists", () => {
  assert.ok(fs.existsSync(apiDocPath));
});

test("API doc states non-public contract and current scope", () => {
  assert.match(
    apiDoc,
    /본 문서는 공개 개발자 API 계약 문서가 (?:아닙니다|아니며)/,
  );

  assert.ok(
    apiDoc.includes("공식 공개 API 문서는 준비 중입니다."),
    "official public API documentation remains in preparation",
  );

  [
    "곰도리 웹앱 런타임",
    "Public/guest-scoped APIs",
    "Teacher/authenticated APIs",
    "Google Workspace 연동 및 로스터 동기화는 현재 준비 중입니다.",
  ].forEach((k) => assert.ok(apiDoc.includes(k), k));
});

test("API doc avoids overclaiming", () => {
  [
    "공식 공개 API 제공",
    "Google Workspace 연동 완료",
    "로스터 자동 동기화 지원",
    "API SLA 보장",
  ].forEach((k) => assert.ok(!apiDoc.includes(k), k));
});

test("school page separates current capabilities from planned institutional integrations", () => {
  const available = schoolPage.match(/const availableCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  ["교사 수업 보드", "링크·코드로 학생 참여"].forEach((label) => assert.ok(available.includes(label), label));
  ["Google Workspace 연동", "명단 동기화", "기관 관리자"].forEach((label) => {
    assert.ok(planned.includes(label), label);
    assert.ok(!available.includes(label), `${label} is not advertised as available`);
  });
  assert.match(schoolPage, /<h2[^>]*>지금 이용 가능<\/h2>[\s\S]*?\{availableCapabilities\.map/);
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
});

test("core trust docs link API_AND_INTEGRATIONS", () => {
  trustDocs.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(content.includes("docs/API_AND_INTEGRATIONS.md"), file);
  });
});

test("optional route inventory for known APIs", () => {
  [
    "app/api/v1/share/[code]/activity-state/route.ts",
    "app/api/v1/boards/[boardId]/lesson-session/route.ts",
    "app/api/v1/boards/[boardId]/lesson-session/web-studio/settings/route.ts",
    "app/api/v1/boards/[boardId]/lesson-session/web-studio/submissions/route.ts",
  ].forEach((file) => assert.ok(fs.existsSync(file), file));
});
