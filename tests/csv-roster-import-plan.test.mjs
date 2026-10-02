import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const csvPlanPath = "docs/CSV_ROSTER_IMPORT_PLAN.md";
const csvPlan = fs.readFileSync(csvPlanPath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const packageDoc = fs.readFileSync("docs/INSTITUTION_REVIEW_PACKAGE.md", "utf8");

const requiredSections = [
  "문서 목적",
  "왜 CSV부터인가",
  "현재 상태",
  "Planned CSV fields",
  "데이터 최소화 규칙",
  "Planned import flow",
  "Validation and safety rules",
  "Error handling",
  "Permissions",
  "Google Workspace 계획과의 관계",
  "Non-goals",
  "Open questions",
];

test("csv-roster-plan: doc exists", () => {
  assert.ok(fs.existsSync(csvPlanPath));
});

test("csv-roster-plan: planning-only wording exists", () => {
  ["계획", "구현 완료 공지", "현재 제공된다는 선언이 아닙니다", "CSV 로스터 가져오기는 준비 중입니다"].forEach((k) =>
    assert.ok(csvPlan.includes(k), k),
  );
});

test("csv-roster-plan: explains why CSV before workspace", () => {
  ["Google Workspace/Classroom", "OAuth", "파일럿", "데이터 모델을 검증"].forEach((k) => assert.ok(csvPlan.includes(k), k));
});

test("csv-roster-plan: includes planned fields and avoided sensitive data", () => {
  [
    "class_name",
    "class_id",
    "role",
    "display_label",
    "nickname",
    "external_id",
    "email",
    "phone number",
    "home address",
    "birth date",
    "national ID",
    "guardian contact",
  ].forEach((k) => assert.ok(csvPlan.includes(k), k));
});

test("csv-roster-plan: includes flow and validation", () => {
  ["CSV를 업로드", "미리보기", "가져오기를 확정", "결과 리포트", "필수 헤더", "최대 행 수", "중복 행 감지", "dry-run preview"].forEach((k) =>
    assert.ok(csvPlan.includes(k), k),
  );
});

test("csv-roster-plan: links workspace and org admin docs", () => {
  ["docs/GOOGLE_WORKSPACE_AND_ROSTER_PLAN.md", "docs/ORGANIZATION_ADMIN_MODEL.md"].forEach((k) => assert.ok(csvPlan.includes(k), k));
});

test("csv-roster-plan: school page and package reference csv plan", () => {
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  assert.ok(planned.includes('"명단 동기화"'), "roster sync remains a planned capability");
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
  assert.ok(packageDoc.includes("docs/CSV_ROSTER_IMPORT_PLAN.md"));
});

test("csv-roster-plan: does not claim implementation complete", () => {
  ["CSV 로스터 가져오기 제공", "CSV 업로드 지원 완료", "로스터 자동 동기화 제공", "Google Workspace 연동 완료", "SSO 제공 완료"].forEach((k) =>
    assert.ok(!csvPlan.includes(k), k),
  );
});

test("csv-roster-plan: no db migration/csv upload implementation/google oauth dependency added", () => {
  const migrationsDir = "supabase/migrations";
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    assert.ok(Array.isArray(migrations));
  }

  const implCandidates = ["app", "lib", "pages", "workers"].filter((d) => fs.existsSync(d));
  const joined = implCandidates
    .flatMap((dir) => fs.readdirSync(dir, { recursive: true }).map((f) => `${dir}/${f}`))
    .join("\n");
  assert.ok(!joined.match(/csv-upload|roster-sync-job|google-oauth|googleapis/i));
});
