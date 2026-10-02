import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const planPath = "docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md";
const plan = fs.readFileSync(planPath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const apiDoc = fs.readFileSync("docs/API_AND_INTEGRATIONS.md", "utf8");
const linkedDocs = [
  "docs/INSTITUTIONAL_READINESS.md",
  "docs/TRUST_AND_COMPLIANCE.md",
  "docs/DATA_HANDLING_AND_SECURITY.md",
  "docs/SERVICE_OPERATIONS.md",
];

test("google workspace roster plan doc exists", () => {
  assert.ok(fs.existsSync(planPath));
});

test("plan states preparing-not-complete and separates google login from roster sync", () => {
  [
    "Google Workspace 연동 및 로스터 동기화는 준비 중입니다.",
    "Google 계정 로그인과 기관 로스터 동기화는 별개의 기능입니다.",
    "공식 Workspace/로스터 연동을 제공한다고 안내하지 않습니다.",
  ].forEach((k) => assert.ok(plan.includes(k), k));
});

test("plan includes data minimization and forbidden personal data avoidance", () => {
  ["데이터 최소화 원칙", "phone number", "home address", "birth date", "national ID"].forEach((k) =>
    assert.ok(plan.includes(k), k),
  );
});

test("plan includes phased roadmap", () => {
  ["Phase 0", "Phase 1", "Phase 2", "Phase 3", "Phase 4"].forEach((k) => assert.ok(plan.includes(k), k));
});

test("plan avoids implementation-complete claims", () => {
  ["Google Workspace 연동 완료", "Google Classroom 자동 동기화 지원", "로스터 자동 동기화 제공", "SSO 제공", "OAuth 연동 완료"].forEach(
    (k) => assert.ok(!plan.includes(k), k),
  );
});

test("school page references workspace/roster readiness", () => {
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  ["Google Workspace 연동", "명단 동기화"].forEach((label) => assert.ok(planned.includes(label), label));
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
});

test("api doc links to new google workspace roster plan doc", () => {
  assert.ok(apiDoc.includes("docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md"));
});

test("trust and institutional docs link to plan", () => {
  linkedDocs.forEach((file) => {
    const doc = fs.readFileSync(file, "utf8");
    assert.ok(doc.includes("docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md"), file);
  });
});
