import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schemaDocPath = "docs/CSV_ROSTER_SCHEMA_DESIGN.md";
const schemaDoc = fs.readFileSync(schemaDocPath, "utf8");
const csvPlanDoc = fs.readFileSync("docs/CSV_ROSTER_IMPORT_PLAN.md", "utf8");
const orgDoc = fs.readFileSync("docs/ORGANIZATION_ADMIN_MODEL.md", "utf8");
const gwDoc = fs.readFileSync("docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md", "utf8");
const dataDoc = fs.readFileSync("docs/DATA_HANDLING_AND_SECURITY.md", "utf8");
const apiDoc = fs.readFileSync("docs/API_AND_INTEGRATIONS.md", "utf8");
const pkgDoc = fs.readFileSync("docs/INSTITUTION_REVIEW_PACKAGE.md", "utf8");
const qaDoc = fs.readFileSync("docs/QA_TEACHER_BOARD.md", "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");

test("schema design doc exists and is design-only", () => {
  assert.equal(fs.existsSync(schemaDocPath), true);
  ["미래 데이터 모델 설계", "구현 완료 공지", "DB migration", "아직 제공되지 않습니다"].forEach((k) => assert.ok(schemaDoc.includes(k)));
});

test("schema design doc includes planned entities and compatibility", () => {
  ["organizations", "organization_memberships", "roster_classes", "roster_participants", "roster_import_batches", "roster_import_errors"].forEach((k) => assert.ok(schemaDoc.includes(k)));
  ["participant_key_hash", "guest participant 흐름은 계속 지원", "email을 필수로 요구하지 않습니다", "실명 단독 매칭 금지"].forEach((k) => assert.ok(schemaDoc.includes(k)));
});

test("schema design doc includes sensitive-field avoidance and migration phases", () => {
  ["phone", "address", "birth_date", "national_id", "guardian_name", "guardian_phone"].forEach((k) => assert.ok(schemaDoc.includes(k)));
  ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "이번 PR에서는 DB migration을 추가하지 않습니다"].forEach((k) => assert.ok(schemaDoc.includes(k)));
});

test("linked docs reference schema design doc", () => {
  [csvPlanDoc, orgDoc, gwDoc, dataDoc, apiDoc, pkgDoc, qaDoc].forEach((doc) => {
    assert.ok(doc.includes("docs/CSV_ROSTER_SCHEMA_DESIGN.md"));
  });
});

test("/school references schema design cautiously and no implementation claims", () => {
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  assert.ok(planned.includes('"명단 동기화"'), "roster sync remains a planned capability");
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
  ["CSV 로스터 가져오기 제공", "CSV 업로드 지원 완료", "Google Workspace 연동 완료"].forEach((k) => assert.equal(schoolPage.includes(k), false));
});

test("no persistence or public roster import implementation artifacts were added", () => {
  const migrationFiles = fs.readdirSync("supabase/migrations").filter((f) => /roster|organization/i.test(f));
  assert.equal(migrationFiles.some((f) => /csv|roster|organization/i.test(f)), false);
  assert.equal(fs.existsSync("app/api/v1/roster"), false);
  assert.equal(fs.existsSync("lib/roster/csvRosterParser.ts"), true);
  assert.equal(fs.existsSync("lib/google-workspace"), false);
});
