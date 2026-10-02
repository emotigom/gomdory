import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const page = read("app", "dashboard", "files", "page.tsx");
const client = read("app", "dashboard", "files", "FileLibraryClient.tsx");
const styles = read("app", "dashboard", "files", "FileLibraryClient.module.css");

test("files page uses one authenticated workshop header", () => {
  assert.match(page, /await requireUser\(routes\.page\.dashboard\.files\(\)\)/);
  assert.match(page, /data-dashboard-files-workshop="paper-drawer"/);
  assert.match(page, /data-dashboard-workshop-version="2"/);
  assert.match(page, /MATERIAL DRAWER \/ 수업 자료/);
  assert.match(page, /<kbd[^>]*>\/</);
  assert.match(page, /<kbd[^>]*>U</);
  assert.match(page, /<kbd[^>]*>X</);
  assert.doesNotMatch(page, /DashboardPurposeHeader|statusHint|nextAction/);
  assert.equal((page.match(/<h1/g) ?? []).length, 1, "the standalone page must have one h1");
});

test("file library keeps every storage and board API contract", () => {
  const contracts = [
    /apiV1Path\(`files\?\$\{params\.toString\(\)\}`\)/,
    /apiV1Path\("files\/tags\/suggest"\)/,
    /apiV1Path\("dashboard\/boards\?lite=1"\)/,
    /apiV1Path\(`files\/\$\{fileId\}\/tags`\)/,
    /apiV1Path\(`boards\/\$\{boardId\}\/files\/attach`\)/,
    /apiV1Path\(`boards\/\$\{selectedBoardId\}\/files\/upload-plan`\)/,
    /apiV1Path\(`boards\/\$\{selectedBoardId\}\/files\/commit`\)/,
    /apiV1Path\("files\/upload\/prepare"\)/,
    /apiV1Path\("files\/upload\/commit"\)/,
  ];

  contracts.forEach((contract) => assert.match(client, contract));
  assert.match(client, /method: "DELETE"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /xhr\.open\("PUT", url\)/);
  assert.match(client, /handleDeleteFile\(firstFileId\)/);
  assert.match(client, /handleBulkDelete\(deleteRequest\.fileIds\)/);
  assert.doesNotMatch(client, /window\.(?:confirm|prompt)\(/);
});

test("file controls remain keyboard and screen-reader operable", () => {
  assert.match(client, /event\.key === "\/"/);
  assert.match(client, /event\.key\.toLowerCase\(\) === "u"/);
  assert.match(client, /event\.key\.toLowerCase\(\) === "x"/);
  assert.match(client, /aria-pressed=\{selectionMode\}/);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /event\.key !== "Tab"/);
  assert.match(client, /previousFocus\?\.isConnected/);
  assert.match(client, /FileDeleteConfirmDialog/);
  assert.match(client, /삭제한 파일은 되돌릴 수 없습니다/);
  assert.match(client, /"영구 삭제"/);
  assert.match(client, /libraryFocusRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(client, /ref=\{libraryFocusRef\}/);
  assert.match(client, /focusFallback=\{libraryFocusRef\.current\}/);
  assert.match(client, /opener\.matches\(":disabled"\)/);
  assert.match(client, /focusFallback\?\.isConnected/);
  assert.match(client, /focusTarget\?\.focus\(\)/);
  assert.match(client, /document\.addEventListener\("pointerdown"/);
  assert.match(client, /triggerRef\.current\?\.focus/);
  assert.match(client, /role="status"/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /aria-label="파일명 또는 태그 검색"/);
  assert.match(client, /aria-label="넣을 보드 검색"/);
  assert.equal(
    (client.match(/aria-label=\{`\$\{file\.filename\} 선택`\}/g) ?? []).length,
    2,
    "grid and list checkboxes need their own accessible labels",
  );
});

test("uploads expose and require a real board target", () => {
  assert.match(client, /const canUpload = selectedUploadBoard !== null/);
  assert.match(client, /id="upload-board-target"/);
  assert.match(client, /aria-label="업로드할 보드 선택"/);
  assert.match(client, /disabled=\{!canUpload\}/);
  assert.match(client, /href=\{routes\.page\.dashboard\.root\(\)\}/);
  assert.match(client, /보드가 있어야 파일을 올릴 수 있어요/);
  assert.match(client, /if \(!canUpload\)/);
  assert.doesNotMatch(client, /styles\.storageShelf|DEFAULT DRAWER/);
});

test("files workshop is theme-driven paper furniture instead of a rounded SaaS shell", () => {
  assert.match(client, /FileLibraryClient\.module\.css/);
  assert.match(client, /styles\.toolShelf/);
  assert.match(client, /styles\.uploadTray/);
  assert.match(client, /styles\.libraryCabinet/);
  assert.match(client, /styles\.fileCard/);
  assert.match(client, /styles\.drawer/);
  assert.doesNotMatch(client, /<h1[^>]*>내 파일함/);

  assert.match(styles, /var\(--theme-text\)/);
  assert.match(styles, /var\(--theme-surface\)/);
  assert.match(styles, /var\(--theme-border-strong\)/);
  assert.match(styles, /var\(--theme-accent\)/);
  assert.match(styles, /var\(--theme-focus\)/);
  assert.match(styles, /box-shadow: 5px 5px 0/);
  assert.match(styles, /border-radius: 2px !important/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgb\(/i);
});
