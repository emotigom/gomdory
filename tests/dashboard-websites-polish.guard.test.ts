import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("dashboard websites pages own a dedicated interaction scope", () => {
  const shell = read("app", "dashboard", "websites", "_components", "WebsiteStudioShell.tsx");
  const starter = read("app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");
  const editor = read("app", "dashboard", "websites", "[siteId]", "edit", "WebsiteStudioEditorClient.tsx");
  const review = read("app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx");
  const css = read("app", "globals.css");

  assert.match(shell, /data-dashboard-websites-scope/);
  assert.match(starter, /dashboard-websites-card/);
  assert.match(starter, /dashboard-websites-empty-state/);
  assert.match(starter, /dashboard-websites-control/);
  assert.match(editor, /dashboard-websites-input/);
  assert.match(editor, /dashboard-websites-row/);
  assert.match(review, /dashboard-websites-preview/);
  assert.match(review, /dashboard-websites-summary/);

  assert.match(css, /\[data-dashboard-websites-scope\] \.dashboard-websites-card/);
  assert.match(css, /dashboard-websites-control:focus-visible/);
  assert.match(css, /dashboard-websites-input:focus-visible/);
  assert.match(css, /dashboard-websites-card:focus-within/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*dashboard-websites-control/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*dashboard-websites-control/);
  assert.match(css, /not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[data-disabled="true"\]\):active/);
});

test("dashboard websites polish keeps action labels and text visible", () => {
  const starter = read("app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");
  const editor = read("app", "dashboard", "websites", "[siteId]", "edit", "WebsiteStudioEditorClient.tsx");
  const review = read("app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx");
  const published = read("app", "dashboard", "websites", "[siteId]", "published", "page.tsx");

  assert.match(starter, /이어서 만들기/);
  assert.match(starter, /복제/);
  assert.match(starter, /삭제/);
  assert.match(starter, /이 템플릿으로 시작/);
  assert.match(editor, /배포 전 점검하기/);
  assert.match(editor, /위로/);
  assert.match(editor, /아래로/);
  assert.match(review, /공유 링크 만들기/);
  assert.match(review, /링크 복사/);
  assert.match(review, /공개 웹사이트 열기/);
  assert.match(review, /HTML 복사/);
  assert.match(review, /index\.html 다운로드/);
  assert.match(published, /점검 화면으로 돌아가기/);
});

test("dashboard websites scope stays separate from other dashboard and public scopes", () => {
  const css = read("app", "globals.css");
  const websitesBlock = css.match(/\[data-dashboard-websites-scope\][\s\S]*?(?=\nhtml\[data-theme="hud"\] \.hud-top-chrome::before)/)?.[0] ?? "";

  assert.ok(websitesBlock.length > 0, "dashboard websites CSS block should exist");
  assert.doesNotMatch(websitesBlock, /data-dashboard-shell-scope|dashboard-shell-/);
  assert.doesNotMatch(websitesBlock, /data-dashboard-storage-scope|dashboard-storage-/);
  assert.doesNotMatch(websitesBlock, /data-dashboard-billing-scope|dashboard-billing-/);
  assert.doesNotMatch(websitesBlock, /data-dashboard-files-scope|dashboard-files-/);
  assert.doesNotMatch(websitesBlock, /data-dashboard-board-list-scope|dashboard-board-list-/);
  assert.doesNotMatch(websitesBlock, /data-(?:auth|school|marketing|pricing|contact|templates|legal)-interaction-scope/);
  assert.doesNotMatch(websitesBlock, /(^|\s)(button|a|\[role="button"\])\s*[:{,]/);
});

test("dashboard websites polish does not touch publish API, local storage, auth/session, or protected board files", () => {
  const protectedFiles = [
    "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
    "app/s/[code]/_components/StudentBoardMinimal.tsx",
    "app/api/website-studio/publish/route.ts",
    "app/api/website-studio/publish/[id]/unpublish/route.ts",
    "lib/website-studio/websiteStudioLocalStore.ts",
    "lib/website-studio/websiteStudioPublish.ts",
    "lib/website-studio/websiteStudioPublishedBoard.ts",
    "app/dashboard/_components/dashboardGlassButton.ts",
  ];

  for (const file of protectedFiles) {
    const source = read(...file.split(path.sep));
    assert.doesNotMatch(source, /data-dashboard-websites-scope|dashboard-websites-control|dashboard-websites-card|dashboard-websites-input/);
  }
});

test("dashboard websites long titles and urls have overflow defenses", () => {
  const starter = read("app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");
  const editor = read("app", "dashboard", "websites", "[siteId]", "edit", "WebsiteStudioEditorClient.tsx");
  const review = read("app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx");
  const css = read("app", "globals.css");

  assert.match(starter, /min-w-0 truncate font-semibold text-white/);
  assert.match(starter, /min-w-0 break-words text-sm text-slate-200/);
  assert.match(editor, /min-w-0 truncate text-xl font-semibold/);
  assert.match(editor, /flex min-w-0 flex-wrap/);
  assert.match(review, /min-w-0 truncate text-sm text-slate-300/);
  assert.match(review, /break-words/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /max-width: 100%/);
});
