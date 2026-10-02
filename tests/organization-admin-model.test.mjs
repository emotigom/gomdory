import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";

const orgDocPath = "docs/ORGANIZATION_ADMIN_MODEL.md";
const orgDoc = fs.readFileSync(orgDocPath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const gwDoc = fs.readFileSync("docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md", "utf8");
const apiDoc = fs.readFileSync("docs/API_AND_INTEGRATIONS.md", "utf8");
const dataDoc = fs.readFileSync("docs/DATA_HANDLING_AND_SECURITY.md", "utf8");
const trustDoc = fs.readFileSync("docs/TRUST_AND_COMPLIANCE.md", "utf8");
const institutionDoc = fs.readFileSync("docs/INSTITUTIONAL_READINESS.md", "utf8");

test("organization-admin: model doc exists", () => {
  assert.ok(fs.existsSync(orgDocPath));
});

test("organization-admin: planned and not current", () => {
  assert.match(orgDoc, /계획 상태/);
  assert.match(orgDoc, /기관 관리자 기능은 준비 중입니다/);
  assert.match(orgDoc, /정식 제공하지 않습니다/);
});

test("doc distinguishes teacher board role from institution admin", () => {
  assert.match(orgDoc, /교사 계정 중심 운영/);
  assert.match(orgDoc, /기관 단위 권한 모델 초안/);
});

test("doc records the current planned organization scope", () => {
  assert.match(orgDoc, /계획 범위/);
  assert.match(orgDoc, /교사\/학생\/관리자 역할 분리/);
  assert.match(orgDoc, /조직 설정 및 감사 로그 검토/);
});

test("doc keeps guest participation and roster planning separate", () => {
  assert.match(orgDoc, /게스트 수업 흐름/);
  assert.match(orgDoc, /Workspace\/로스터 연동/);
  assert.match(gwDoc, /Phase 4/);
});

test("doc avoids overclaiming unimplemented features", () => {
  ["기관 관리자 기능 제공", "조직 계정 지원 완료", "SSO 제공", "로스터 자동 동기화 제공", "감사 로그 제공", "기관 데이터 내보내기 제공"].forEach((k) => {
    assert.ok(!orgDoc.includes(k), k);
  });
});

test("school page references organization/admin readiness", () => {
  const available = schoolPage.match(/const availableCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  assert.ok(available.includes('"교사 수업 보드"'));
  assert.ok(planned.includes('"기관 관리자"'));
  assert.ok(!available.includes('"기관 관리자"'), "institution admin must not be advertised as available");
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
});

test("organization admin model links to current institutional planning sources", () => {
  ["docs/INSTITUTIONAL_READINESS.md", "docs/ADOPTION_INQUIRY_AND_CONTRACT_READINESS.md", "docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md"].forEach((docPath) => {
    assert.ok(orgDoc.includes(docPath));
  });
});

test("no DB migration or google oauth dependency added for this planning doc test", () => {
  const changed = execSync("git diff --name-only --cached && git diff --name-only", { encoding: "utf8" })
    .split(/\n+/)
    .filter(Boolean);
  assert.ok(!changed.some((f) => f.startsWith("supabase/migrations/")));
  assert.ok(!changed.some((f) => /google|oauth/i.test(f) && /package\.json|pnpm-lock|package-lock/.test(f)));
});
