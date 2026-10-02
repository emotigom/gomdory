import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath = "app/dashboard/tools/csv-roster-dry-run/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");
const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const apiRoutePath = "app/api/v1/dashboard/roster/csv-dry-run/route.ts";
const apiRoute = fs.readFileSync(apiRoutePath, "utf8");

test("csv-roster-dry-run-page: internal dashboard route exists", () => {
  assert.ok(fs.existsSync(pagePath));
});

test("csv-roster-dry-run-page: includes required internal preview wording", () => {
  [
    "CSV 로스터 Dry-run 검증",
    "저장하지 않고",
    "정식 제공되지 않습니다",
    "검사 결과는 저장되거나 DB에 반영되지 않습니다.",
    "인증된 내부 검증 API로만 전송됩니다.",
  ].forEach((k) => assert.ok(page.includes(k), k));
});

test("csv-roster-dry-run-page: renders CsvRosterDryRunPreview", () => {
  assert.ok(page.includes("<CsvRosterDryRunPreview enableServerDryRun={ENABLE_CSV_ROSTER_DRY_RUN_API} />"));
});

test("csv-roster-dry-run-page: server-side feature flag and disabled-by-default gating", () => {
  assert.ok(page.includes("process.env.ENABLE_CSV_ROSTER_DRY_RUN_PAGE === \"1\""));
  assert.ok(page.includes("process.env.ENABLE_CSV_ROSTER_DRY_RUN_API === \"true\""));
  assert.ok(page.includes("notFound()"));
  assert.ok(!page.includes("NEXT_PUBLIC_ENABLE_CSV_ROSTER_DRY_RUN_PAGE"));
});

test("csv-roster-dry-run-page: requires authenticated dashboard context", () => {
  assert.ok(page.includes("requireUser(\"/dashboard/tools/csv-roster-dry-run\")"));
});

test("csv-roster-dry-run-page: /school keeps preparing-only posture and no internal dry-run link", () => {
  const planned = schoolPage.match(/const plannedCapabilities\s*=\s*(\[[^\]]*\])/s)?.[1] ?? "";
  assert.ok(planned.includes('"명단 동기화"'), "roster sync remains a planned capability");
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
  assert.ok(!schoolPage.includes("/dashboard/tools/csv-roster-dry-run"));
  assert.ok(!schoolPage.includes("CSV 로스터 Dry-run 검증"));
});

test("csv-roster-dry-run-page: optional API stays parser-only and non-persistent", () => {
  assert.ok(fs.existsSync(apiRoutePath));
  assert.match(apiRoute, /ENABLE_CSV_ROSTER_DRY_RUN_API/);
  assert.match(apiRoute, /requireUserApi/);
  assert.match(apiRoute, /parseCsvRosterDryRun/);
  assert.doesNotMatch(apiRoute, /createSupabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(|storage\.from|putObject|S3/);
});

test("csv-roster-dry-run-page: no CSV roster DB migration added", () => {
  const migrationRoot = "supabase/migrations";
  const migrationFiles = fs.existsSync(migrationRoot) ? fs.readdirSync(migrationRoot, { recursive: true }).map(String) : [];
  assert.equal(migrationFiles.some((name) => /csv.*roster|roster.*csv/i.test(name)), false);
});

test("csv-roster-dry-run-page: preview reads selected files locally without storage upload", () => {
  const preview = fs.readFileSync("components/roster/CsvRosterDryRunPreview.tsx", "utf8");
  assert.match(preview, /selectedFile\.text\(\)/);
  assert.doesNotMatch(preview, /createSignedUploadUrl|storage\.from|putObject|S3Client|R2Bucket/);
});
