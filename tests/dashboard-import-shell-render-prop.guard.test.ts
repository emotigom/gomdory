import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();

const importRoutes = [
  {
    name: "board",
    page: "app/dashboard/import/board/page.tsx",
    client: "app/dashboard/import/board/BoardImportClient.tsx",
    preview: "BoardImportPreview",
  },
  {
    name: "padlet",
    page: "app/dashboard/import/padlet/page.tsx",
    client: "app/dashboard/import/padlet/PadletImportClient.tsx",
    preview: "PadletImportPreview",
  },
  {
    name: "recap",
    page: "app/dashboard/import/recap/page.tsx",
    client: "app/dashboard/import/recap/RecapImportClient.tsx",
    preview: "RecapImportPreview",
  },
] as const;

const forbiddenChangedPrefixes = [
  "app/api/v1/dashboard/import/",
  "lib/board/",
  "lib/padlet/",
  "lib/recap/",
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

test("ImportBoardsShell keeps a typed render-prop children contract", () => {
  const shell = read("app/dashboard/import/ImportBoardsShell.tsx");

  assert.match(
    shell,
    /type ImportBoardsShellChildren = \(boards: BoardOption\[\]\) => React\.ReactNode;/,
  );
  assert.match(shell, /children: ImportBoardsShellChildren;/);
  assert.match(shell, /\{children\(resolvedBoards\)\}/);
});

test("active import pages do not pass render-prop functions across the server/client boundary", () => {
  for (const route of importRoutes) {
    const page = read(route.page);
    const clientName = `${route.name[0].toUpperCase()}${route.name.slice(1)}ImportClient`;

    assert.doesNotMatch(page, /<ImportBoardsShell[\s\S]*?>[\s\S]*?\{\s*\([^)]*boards/);
    assert.doesNotMatch(page, /=>\s*<\w+ImportPreview/);
    assert.match(page, new RegExp(`import ${clientName} from "\\./${clientName}";`));
    assert.match(page, new RegExp(`return <${clientName} />;`));
  }
});

test("active import client wrappers pass render-prop children to ImportBoardsShell", () => {
  for (const route of importRoutes) {
    const client = read(route.client);

    assert.match(client, /^"use client";/);
    assert.match(client, /import ImportBoardsShell from "\.\.\/ImportBoardsShell";/);
    assert.match(client, new RegExp(`import ${route.preview} from "\\./${route.preview}";`));
    assert.match(client, /<ImportBoardsShell[\s\S]*?>[\s\S]*?\{\(boards\) =>/);
    assert.match(client, new RegExp(`<${route.preview} boards=\\{boards\\} />`));
  }
});

test("import shell render-prop fix does not edit import API or parser/runtime sources", () => {
  const changed = changedFiles();
  const forbidden = changed.filter((file) =>
    forbiddenChangedPrefixes.some((prefix) => file.startsWith(prefix)),
  );

  assert.deepEqual(forbidden, []);
});
