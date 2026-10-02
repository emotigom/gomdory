const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const inspectPath = path.join(process.cwd(), "supabase", "manual", "inspect_board_upload_contract.sql");
const verifyPath = path.join(process.cwd(), "supabase", "manual", "verify_board_upload_contract.sql");
const permissionCasePath = path.join(process.cwd(), "supabase", "manual", "inspect_board_upload_permission_case.sql");

const inspectSql = readFileSync(inspectPath, "utf8").toLowerCase();
const verifySql = readFileSync(verifyPath, "utf8").toLowerCase();
const permissionCaseSql = readFileSync(permissionCasePath, "utf8").toLowerCase();

for (const [name, sql] of [["inspect", inspectSql], ["verify", verifySql]]) {
  test(`${name} SQL uses pg_class RLS metadata, not pg_tables.forcerowsecurity`, () => {
    assert.equal(sql.includes("pg_tables.forcerowsecurity"), false);
    assert.equal(sql.includes("from pg_tables"), false, `${name} SQL should avoid pg_tables for RLS metadata`);
    assert.equal(sql.includes("relforcerowsecurity"), true);
    assert.equal(sql.includes("relrowsecurity"), true);
  });
}

test("inspect SQL includes policy/function/RLS inspection sections", () => {
  assert.equal(inspectSql.includes("from pg_policies"), true);
  assert.equal(inspectSql.includes("pg_get_functiondef"), true);
  assert.equal(inspectSql.includes("pg_class"), true);
  assert.equal(inspectSql.includes("relrowsecurity"), true);
  assert.equal(inspectSql.includes("relforcerowsecurity"), true);
});

test("manual SQL files include schema-adaptive column checks", () => {
  assert.equal(inspectSql.includes("information_schema.columns"), true);
  assert.equal(verifySql.includes("information_schema.columns"), true);
  assert.equal(inspectSql.includes("column_exists"), true);
  assert.equal(verifySql.includes("storage_key") && verifySql.includes("r2_key"), true);
});

test("manual SQL files avoid brittle empty-string escaping and use safe dynamic SQL formatting", () => {
  assert.equal(inspectSql.includes("= '''"), false);
  assert.equal(verifySql.includes("= '''"), false);
  assert.equal(/btrim\([^)]*\)\s*=\s*'''/i.test(inspectSql), false);
  assert.equal(/btrim\([^)]*\)\s*=\s*'''/i.test(verifySql), false);
  assert.equal(inspectSql.includes("format(") && inspectSql.includes("%i") && inspectSql.includes("%l"), true);
  assert.equal(verifySql.includes("format(") && verifySql.includes("%i") && verifySql.includes("%l"), true);
});


test("manual SQL files avoid single-quoted EXECUTE btrim count patterns", () => {
  const brittleExecPattern = /execute\s+'select\s+count\(\*\)[^']*btrim/i;
  assert.equal(brittleExecPattern.test(inspectSql), false);
  assert.equal(brittleExecPattern.test(verifySql), false);
});

test("manual SQL files use format(%I,%L) with information_schema guards for optional file columns", () => {
  assert.equal(/information_schema\.columns/.test(inspectSql), true);
  assert.equal(/information_schema\.columns/.test(verifySql), true);
  assert.equal(/execute\s+format\([\s\S]*%i[\s\S]*%l/.test(inspectSql), true);
  assert.equal(/execute\s+format\([\s\S]*%i[\s\S]*%l/.test(verifySql), true);
  assert.equal(inspectSql.includes("foreach col_name in array"), true);
  assert.equal(verifySql.includes("foreach col_name in array"), true);
});
test("permission-case SQL is read-only", () => {
  for (const bad of ["update ", "delete ", "alter table", "drop policy", "create policy", "disable row level security"]) {
    assert.equal(permissionCaseSql.includes(bad), false, `permission case SQL must not contain ${bad}`);
  }
  assert.equal(permissionCaseSql.includes("with input as") || permissionCaseSql.includes("with input_raw as") || permissionCaseSql.includes("inspect_permission_results"), true);
  assert.equal(permissionCaseSql.includes("<board_id>"), true);
  assert.equal(permissionCaseSql.includes("<card_id>"), true);
  assert.equal(permissionCaseSql.includes("<user_id>"), true);
});

test("supabase/manual has no destructive SQL", () => {
  const manualDir = path.join(process.cwd(), "supabase", "manual");
  const files = readdirSync(manualDir).filter((name) => name.endsWith(".sql"));
  const destructivePatterns = [
    /\balter\s+table\b/i,
    /\bdrop\s+policy\b/i,
    /\bcreate\s+policy\b/i,
    /\bupdate\s+public\./i,
    /\bdelete\s+from\s+public\./i,
    /\bdisable\s+row\s+level\s+security\b/i,
  ];

  for (const file of files) {
    const sql = readFileSync(path.join(manualDir, file), "utf8");
    for (const pattern of destructivePatterns) {
      assert.equal(pattern.test(sql), false, `${file} should not include destructive statement: ${pattern}`);
    }
  }
});


test("permission-case SQL detects membership tables adaptively", () => {
  assert.equal(permissionCaseSql.includes("to_regclass('public.board_members')"), true);
  assert.equal(permissionCaseSql.includes("to_regclass('public.memberships')"), true);
  assert.equal(permissionCaseSql.includes("to_regclass('public.board_memberships')"), true);
  assert.equal(permissionCaseSql.includes("to_regclass('public.classroom_members')"), true);
  assert.equal(permissionCaseSql.includes("information_schema.columns"), true);
  assert.equal(permissionCaseSql.includes("membership_table_missing"), true);
});

test("permission-case SQL avoids unguarded hard-coded memberships queries", () => {
  assert.equal(/from\s+public\.memberships\s+/i.test(permissionCaseSql), false);
});

test("permission-case SQL validates placeholders before UUID cast", () => {
  assert.equal(permissionCaseSql.includes("replace board_id/card_id/user_id before running focused case inspection"), true);
  assert.equal(permissionCaseSql.includes("'<board_id>'"), true);
  assert.equal(permissionCaseSql.includes("'<card_id>'"), true);
  assert.equal(permissionCaseSql.includes("'<user_id>'"), true);
  assert.equal(permissionCaseSql.includes("~* '^[0-9a-f]{8}-[0-9a-f]{4}"), true);
});
