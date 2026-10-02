import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CsvRosterDryRunPreview, PRIVACY_SAFE_EXAMPLE_CSV } from "@/components/roster/CsvRosterDryRunPreview";
import { buildPrivacySafeRosterCsvTemplate } from "@/lib/roster/csvRosterTemplate";

const containsAny = (value: string, needles: string[]) => needles.some((needle) => value.includes(needle));

test("component renders CSV text area and 검사하기 button", () => {
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview />);
  assert.match(html, /CSV 내용/);
  assert.match(html, /검사하기/);
});

test("privacy-safe example CSV exists and excludes sensitive tokens", () => {
  assert.match(PRIVACY_SAFE_EXAMPLE_CSV, /학급명,역할,표시명,외부ID/);
  assert.equal(containsAny(PRIVACY_SAFE_EXAMPLE_CSV, ["전화번호", "주소", "생년월일", "주민", "보호자", "guardian", "@"]), false);
});

test("summary labels and safe accepted row preview render", () => {
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview initialCsvText={PRIVACY_SAFE_EXAMPLE_CSV} />);
  assert.match(html, /전체 행/);
  assert.match(html, /유효 행/);
  assert.match(html, /오류 행/);
  assert.match(html, /경고 수/);
  assert.match(html, /감지된 학급 수/);
  assert.match(html, /교사 수/);
  assert.match(html, /학생 수/);
  assert.match(html, /class_name/);
  assert.match(html, /display_label/);
  assert.match(html, /external_id/);
  assert.doesNotMatch(html, /전화번호/);
});

test("sensitive column warning renders but sensitive values are hidden", () => {
  const csv = "학급명,역할,표시명,외부ID,전화번호\n1반,학생,탐험가A,S-001,010-9999-1234";
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview initialCsvText={csv} />);
  assert.match(html, /공식 로스터 CSV에는 전화번호/);
  assert.match(html, /sensitive_column_detected/);
  assert.match(html, /전화번호/);
  const previewAndIssues = html.slice(html.indexOf("</textarea>"));
  assert.doesNotMatch(previewAndIssues, /010-9999-1234/);
});

test("invalid role and missing display_label issues render", () => {
  const csv = "학급명,역할,표시명\n1반,학부모,\n";
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview initialCsvText={csv} />);
  assert.match(html, /invalid_role/);
  assert.match(html, /missing_display_label/);
});

test("optional API remains authenticated, parser-only, and non-persistent", () => {
  const apiPath = path.join(process.cwd(), "app", "api", "v1", "dashboard", "roster", "csv-dry-run", "route.ts");
  const migrationRoot = path.join(process.cwd(), "supabase", "migrations");
  const migrationFiles = fs.existsSync(migrationRoot) ? fs.readdirSync(migrationRoot, { recursive: true }).map(String) : [];

  const apiRoute = fs.readFileSync(apiPath, "utf8");
  assert.match(apiRoute, /ENABLE_CSV_ROSTER_DRY_RUN_API/);
  assert.match(apiRoute, /requireUserApi/);
  assert.match(apiRoute, /parseCsvRosterDryRun/);
  assert.doesNotMatch(apiRoute, /createSupabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(|storage\.from|putObject|S3/);
  assert.equal(migrationFiles.some((name) => /csv.*roster|roster.*csv/i.test(name)), false);
});


test("preview uses template generator", () => {
  assert.equal(PRIVACY_SAFE_EXAMPLE_CSV, buildPrivacySafeRosterCsvTemplate());
});



test("server validation UI copy renders with disabled message by default", () => {
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview />);
  assert.match(html, /서버 검증 API가 비활성화되어 있어요/);
});

test("server validation controls render when enabled", () => {
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview enableServerDryRun initialCsvText={PRIVACY_SAFE_EXAMPLE_CSV} />);
  assert.match(html, /서버 검증/);
  assert.match(html, /저장하지 않고 서버에서도 같은 규칙으로 검사합니다/);
});
test("preview renders 오류/경고 badges", () => {
  const csv = "학급명,역할,표시명\n1반,학부모,";
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview initialCsvText={csv} />);
  assert.match(html, /오류/);
  assert.match(html, /경고/);
});


test("file picker copy and controls render", () => {
  const html = renderToStaticMarkup(<CsvRosterDryRunPreview />);
  assert.match(html, /CSV 파일 선택/);
  assert.match(html, /파일은 브라우저에서만 읽고, 서버에 업로드하지 않습니다/);
  assert.match(html, /파일 내용 불러오기/);
  assert.match(html, /선택한 파일 지우기/);
  assert.match(html, /accept="\.csv,text\/csv"/);
});

test("file error messages render when state is set", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "components/roster/CsvRosterDryRunPreview.tsx"), "utf8");
  assert.match(src, /CSV 파일이 너무 큽니다\./);
  assert.match(src, /CSV 파일을 읽지 못했어요\./);
  assert.match(src, /selectedFile\.text\(\)/);
});

test("file selection does not auto-call server validation", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "components/roster/CsvRosterDryRunPreview.tsx"), "utf8");
  assert.ok(src.includes("onChange={(event) =>"));
  assert.ok(!src.includes("onChange={(event) => handleServerValidation"));
});
