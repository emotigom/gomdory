import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const shareSource = read("lib", "data", "share.ts");
const actionsSource = read("app", "dashboard", "ops", "share-codes", "actions.ts");
const pageSource = read("app", "dashboard", "ops", "share-codes", "page.tsx");
const modulesSource = read("lib", "ops", "adminModules.ts");
const baselineSource = read(
  "supabase",
  "migrations",
  "20260929093150_successor_baseline.sql",
);

test("share-code policy permanently excludes ambiguous characters", () => {
  assert.match(shareSource, /SHARE_CODE_CHARSET = "23456789abcdefghjkmnpqrstuvwxyz"/);
  assert.match(shareSource, /SHARE_CODE_LENGTH = 6/);
  assert.doesNotMatch(
    shareSource.match(/SHARE_CODE_CHARSET = "([^"]+)"/)?.[1] ?? "",
    /[01ilo]/,
  );
});

test("successor baseline rejects new or updated ambiguous share codes", () => {
  assert.match(baselineSource, /boards_share_code_charset_check/i);
  assert.match(
    baselineSource,
    /share_code\s+IS\s+NULL\s+OR\s+share_code\s+~\s+'\^\[23456789abcdefghjkmnpqrstuvwxyz\]\{6\}\$'(?:::text)?/i,
  );
  assert.match(
    baselineSource,
    /boards_share_code_charset_check[\s\S]*?NOT\s+VALID/i,
  );
  assert.doesNotMatch(
    baselineSource.match(/share_code\s+~\s+'\^\[([^\]]+)\]/i)?.[1] ?? "",
    /[01ilo]/,
  );
});

test("ops easy-code assignment reuses the canonical validator and defaults to read-only", () => {
  assert.match(actionsSource, /isValidShareCode\(shareCode\)/);
  assert.match(actionsSource, /trim\(\)\.toLowerCase\(\)/);
  assert.match(actionsSource, /\.eq\("share_code", shareCode\)/);
  assert.match(actionsSource, /\.neq\("id", boardId\)/);
  assert.match(actionsSource, /share_enabled: true/);
  assert.match(actionsSource, /share_write_enabled: false/);
  assert.match(actionsSource, /isOpsAdmin\(user\.email\)/);
  assert.match(actionsSource, /ops\.share_code\.assigned/);
});

test("ops can close access without losing the code or remove it completely", () => {
  assert.match(actionsSource, /export async function disableEasyShareCodeAction/);
  assert.match(actionsSource, /share_enabled: false[\s\S]*share_write_enabled: false/);
  assert.match(actionsSource, /export async function removeEasyShareCodeAction/);
  assert.match(actionsSource, /share_code: null[\s\S]*share_enabled: false[\s\S]*share_write_enabled: false/);
  assert.match(actionsSource, /ops\.share_code\.disabled/);
  assert.match(actionsSource, /ops\.share_code\.removed/);
});

test("ops UI prevents ambiguous characters before submission", () => {
  assert.match(pageSource, /\[23456789abcdefghjkmnpqrstuvwxyz\]\{6\}/);
  assert.match(pageSource, /minLength=\{6\}/);
  assert.match(pageSource, /maxLength=\{6\}/);
  assert.match(pageSource, /0, 1, i, l, o는 관리자 입력에서도 사용할 수 없습니다/);
  assert.match(pageSource, /읽기 전용으로 열기/);
  assert.match(pageSource, /접속만 닫기/);
  assert.match(pageSource, /코드 제거/);
});

test("ops navigation exposes the easy share-code module", () => {
  assert.match(modulesSource, /key: "share-codes"/);
  assert.match(modulesSource, /href: "\/dashboard\/ops\/share-codes"/);
});
