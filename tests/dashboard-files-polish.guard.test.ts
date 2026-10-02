import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard files page owns a dedicated interaction scope", () => {
  const page = read("app", "dashboard", "files", "page.tsx");
  const client = read("app", "dashboard", "files", "FileLibraryClient.tsx");
  const css = read("app", "globals.css");

  assert.match(page, /data-page-marker="dashboard-files"/);
  assert.match(page, /data-dashboard-files-scope/);
  assert.match(client, /dashboard-files-card/);
  assert.match(client, /dashboard-files-row/);
  assert.match(client, /dashboard-files-control/);
  assert.match(client, /dashboard-files-input/);
  assert.match(client, /dashboard-files-empty-state/);

  assert.match(css, /\[data-dashboard-files-scope\] \.dashboard-files-card/);
  assert.match(css, /dashboard-files-control:focus-visible/);
  assert.match(css, /dashboard-files-input:focus-within/);
  assert.match(css, /dashboard-files-row:focus-within/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-files-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-files-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
});

test("dashboard files polish keeps file action labels and accessible names", () => {
  const client = read("app", "dashboard", "files", "FileLibraryClient.tsx");

  assert.match(client, /업로드/);
  assert.match(client, /파일 선택/);
  assert.match(client, /보드에 넣기/);
  assert.match(client, /태그 편집/);
  assert.match(client, /삭제/);
  assert.match(client, /다시 시도/);
  assert.match(client, /더 불러오기/);
  assert.match(client, /보드 열기/);
  assert.match(client, /aria-label="파일 작업 메뉴"/);
  assert.match(client, /aria-label=\{`\$\{tag\} 태그 제거`\}/);
});

test("dashboard files scope stays separate from other dashboard and public scopes", () => {
  const css = read("app", "globals.css");
  const filesBlock = css.match(/\[data-dashboard-files-scope\][\s\S]*?(?=\nhtml\[data-theme="hud"\] \.hud-top-chrome::before)/)?.[0] ?? "";

  assert.ok(filesBlock.length > 0, "dashboard files CSS block should exist");
  assert.doesNotMatch(filesBlock, /data-dashboard-shell-scope|dashboard-shell-/);
  assert.doesNotMatch(filesBlock, /data-dashboard-storage-scope|dashboard-storage-/);
  assert.doesNotMatch(filesBlock, /data-dashboard-billing-scope|dashboard-billing-/);
  assert.doesNotMatch(filesBlock, /data-dashboard-board-list-scope|dashboard-board-list-/);
  assert.doesNotMatch(filesBlock, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(filesBlock, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);
});

test("dashboard files polish keeps protected file API, upload, storage, attachment, and board runtime files untouched by files UI hooks", () => {
  const protectedFiles = [
    "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
    "app/s/[code]/_components/StudentBoardMinimal.tsx",
    "app/api/v1/files/route.ts",
    "app/api/v1/files/upload/prepare/route.ts",
    "app/api/v1/files/upload/commit/route.ts",
    "app/api/v1/files/[fileId]/download/route.ts",
    "app/api/v1/files/[fileId]/delete/route.ts",
    "app/api/v1/files/[fileId]/view/route.ts",
    "app/api/v1/boards/[boardId]/files/attach/route.ts",
    "app/api/v1/cards/[cardId]/attachments/[boardFileId]/route.ts",
    "lib/data/files.ts",
    "lib/data/boardFiles.ts",
    "components/dashboard/FileUploader.tsx",
    "app/dashboard/_components/dashboardGlassButton.ts",
  ];

  for (const file of protectedFiles) {
    const source = read(...file.split(path.sep));
    assert.doesNotMatch(source, /data-dashboard-files-scope|dashboard-files-control|dashboard-files-card|dashboard-files-row/);
  }
});

test("dashboard files long names have overflow defenses on rows, cards, and drawer", () => {
  const client = read("app", "dashboard", "files", "FileLibraryClient.tsx");

  assert.match(client, /flex min-w-\[180px\] flex-1/);
  assert.match(client, /className="min-w-0 flex-1"/);
  assert.match(client, /className="min-w-0 truncate text-sm font-semibold text-slate-900"/);
  assert.match(client, /className="mt-1 truncate text-lg font-black text-slate-900"/);
  assert.match(client, /className="min-w-0 max-w-full truncate font-semibold text-slate-800"/);
});
