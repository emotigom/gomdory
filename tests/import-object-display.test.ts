import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { safeDisplayMessage } from "@/lib/ui/safeErrors";

const repoRoot = process.cwd();
const fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

const forbiddenChangedPrefixes = [
  "app/api/v1/dashboard/import/",
  "app/api/v1/import/",
  "lib/board/",
  "lib/padlet/",
  "lib/recap/",
] as const;

const forbiddenChangedFiles = [
  "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
  "app/s/[code]/_components/StudentBoardMinimal.tsx",
] as const;

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function changedFiles() {
  const unstaged = execFileSync("git", ["diff", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return Array.from(
    new Set(
      `${unstaged}\n${staged}\n${untracked}`
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean),
    ),
  );
}

test("safeDisplayMessage formats unknown values without leaking object coercion", () => {
  assert.equal(safeDisplayMessage("그대로 표시", fallback), "그대로 표시");
  assert.equal(safeDisplayMessage(new Error("에러 메시지"), fallback), "에러 메시지");
  assert.equal(safeDisplayMessage({ message: "message 필드" }, fallback), "message 필드");
  assert.equal(safeDisplayMessage({ error: "error 필드" }, fallback), "error 필드");
  assert.equal(safeDisplayMessage({ detail: "detail 필드" }, fallback), "detail 필드");
  assert.equal(safeDisplayMessage({ message: { nested: true } }, fallback), fallback);
  assert.equal(safeDisplayMessage(["array"], fallback), fallback);
  assert.equal(safeDisplayMessage(() => "function", fallback), fallback);
  assert.notEqual(safeDisplayMessage({ plain: true }, fallback), "[object Object]");
});

test("dashboard import board-list issue messages are normalized before shell display", () => {
  const boardsClient = read("lib/data/boards.client.ts");
  const shell = read("app/dashboard/import/ImportBoardsShell.tsx");

  assert.match(boardsClient, /userMessageSource = payload\?\.userMessage \?\? payload\?\.error/);
  assert.match(boardsClient, /safeDisplayMessage\(userMessageSource, IMPORT_BOARDS_FALLBACK_MESSAGE\)/);
  assert.doesNotMatch(boardsClient, /String\(userMessageSource\)|`\$\{userMessageSource\}`/);
  assert.match(shell, /description=\{descriptionText\}/);
  assert.doesNotMatch(shell, /String\(issue\.message\)|`\$\{issue\.message\}`/);
});

test("import object-display fix does not edit import runtime or board clients", () => {
  const changed = changedFiles();
  const forbidden = changed.filter(
    (file) =>
      forbiddenChangedPrefixes.some((prefix) => file.startsWith(prefix)) ||
      forbiddenChangedFiles.includes(file as (typeof forbiddenChangedFiles)[number]),
  );

  assert.deepEqual(forbidden, []);
});
