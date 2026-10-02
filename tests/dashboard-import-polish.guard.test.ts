import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();

const activeImportFiles = [
  "app/dashboard/import/ImportBoardsShell.tsx",
  "app/dashboard/import/board/BoardImportPreview.tsx",
  "app/dashboard/import/padlet/PadletImportPreview.tsx",
  "app/dashboard/import/recap/RecapImportPreview.tsx",
] as const;

const forbiddenChangedPrefixes = [
  "app/api/v1/dashboard/import/",
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

test("dashboard import polish stays scoped to active import UI sources", () => {
  const shell = read("app/dashboard/import/ImportBoardsShell.tsx");
  assert.match(shell, /data-dashboard-import-scope/);

  const globals = read("app/globals.css");
  assert.match(globals, /\[data-dashboard-import-scope\]/);
  assert.match(globals, /\.dashboard-import-control/);
  assert.match(globals, /\.dashboard-import-dropzone/);
  assert.doesNotMatch(
    globals,
    /\[data-dashboard-import-scope\][\s\S]{0,220}\[data-dashboard-(?:shell|board-list|storage|billing|files|websites)-scope\]/,
  );

  for (const relativePath of activeImportFiles) {
    const source = read(relativePath);
    assert.match(
      source,
      /dashboard-import-(?:card|row|control|input|dropzone|empty-state)/,
      `${relativePath} should use import-local polish classes`,
    );
  }
});

test("dashboard import polish does not edit import logic or board runtime sources", () => {
  const changed = changedFiles();
  const forbidden = changed.filter(
    (file) =>
      forbiddenChangedPrefixes.some((prefix) => file.startsWith(prefix)) ||
      forbiddenChangedFiles.includes(file as (typeof forbiddenChangedFiles)[number]),
  );

  assert.deepEqual(forbidden, []);
});

test("dashboard import upload handlers and API paths stay unchanged", () => {
  const board = read("app/dashboard/import/board/BoardImportPreview.tsx");
  assert.match(board, /const handleZipChange = async/);
  assert.match(board, /const handleCommit = async/);
  assert.match(board, /const handleCancel = \(\) =>/);
  assert.match(board, /apiV1Path\("dashboard\/import\/board\/parse-zip"\)/);
  assert.match(board, /xhr\.open\("POST", apiV1Path\("dashboard\/import\/board\/commit-zip"\)\)/);

  const padlet = read("app/dashboard/import/padlet/PadletImportPreview.tsx");
  assert.match(padlet, /const handleFileChange = async/);
  assert.match(padlet, /const handleCommit = async/);
  assert.match(padlet, /apiV1Path\("dashboard\/import\/padlet\/parse"\)/);
  assert.match(padlet, /apiV1Path\("dashboard\/import\/padlet\/commit"\)/);

  const recap = read("app/dashboard/import/recap/RecapImportPreview.tsx");
  assert.match(recap, /const handleJsonFileChange = /);
  assert.match(recap, /const handleZipFileChange = async/);
  assert.match(recap, /const handleSubmit = async/);
  assert.match(recap, /const abortActiveRequest = \(\) =>/);
  assert.match(recap, /apiV1Path\("dashboard\/import\/recap\/parse-zip"\)/);
  assert.match(recap, /apiV1Path\("dashboard\/import\/recap\/commit-zip"\)/);
  assert.match(recap, /apiV1Path\("dashboard\/import\/recap\/commit-json"\)/);
});
