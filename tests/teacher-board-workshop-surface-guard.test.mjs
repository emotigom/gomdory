import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const board = read(
  "app",
  "dashboard",
  "boards",
  "[boardId]",
  "board",
  "TeacherBoardCanonicalClient.tsx",
);
const workshop = read(
  "app",
  "dashboard",
  "boards",
  "[boardId]",
  "board",
  "TeacherBoardCanonicalClient.module.css",
);
const submissionPanel = read(
  "app",
  "dashboard",
  "boards",
  "[boardId]",
  "board",
  "_components",
  "StudentSubmissionStatusPanel.tsx",
);

test("teacher board presents a paper workbench instead of developer HUD copy", () => {
  assert.match(board, /data-teacher-workshop="paper-board"/);
  assert.match(submissionPanel, /data-teacher-submission-panel/);
  assert.match(board, /교사 수업 작업대/);
  assert.match(board, /data-teacher-board-summary="true"/);
  assert.match(board, /data-testid="teacher-empty-wall-hint"/);
  assert.match(board, /data-teacher-card-order-controls="true"/);
  assert.match(board, /data-teacher-card-composer="true"/);
  assert.match(board, /data-teacher-card-create-action="true"/);
  assert.match(board, /aria-label="새 카드 내용"/);
  assert.match(board, /아직 카드가 없어요/);
  assert.match(board, /활동 칸 \{String\(wallIndex \+ 1\)/);
  assert.match(board, /\{cards\.length\}장/);
  assert.doesNotMatch(board, /Canonical board workspace/);
  assert.doesNotMatch(board, /\{cards\.length\} cards/);
  assert.doesNotMatch(board, /TOOL DRAWER|>\s*Document\s*<|>\s*File\s*</);
  assert.doesNotMatch(workshop, /TEACHER \/ LIVE BOARD/);
  assert.match(board, /TeacherBoardCanonicalClient\.module\.css/);
});

test("mobile lesson action opens the real shared tool drawer", () => {
  assert.match(board, /data-testid="mobile-lesson-tools-open"/);
  assert.match(board, /onClick=\{\(\) => openLessonTools\("mobile"\)\}/);
  assert.match(board, /data-testid="canonical-mobile-tools-backdrop"/);
  assert.match(board, /fixed inset-x-3 bottom-3/);
  assert.match(board, /lg:absolute/);
  assert.match(board, /inert=\{!rightRailOpen\}/);
  assert.match(board, /role="tablist"/);
  assert.match(board, /role="tabpanel"/);
  assert.match(board, /aria-selected=\{rightRailTab === tab\.id\}/);
  assert.match(board, /event\.key === "Escape"/);
  assert.doesNotMatch(board, /canonical-right-rail[\s\S]{0,240}hidden -translate-y-1\/2/);
});

test("workshop disclosures and tool drawer stay operable across input modes", () => {
  assert.match(board, /data-testid="mobile-board-actions-toggle"/);
  assert.match(board, /aria-controls="canonical-board-hud-panel"/);
  assert.doesNotMatch(
    board,
    /data-testid="mobile-board-actions-toggle"[\s\S]{0,360}lg:hidden/,
  );
  assert.match(board, /onFocusCapture=\{clearRightRailCloseTimer\}/);
  assert.doesNotMatch(board, /onFocusCapture=\{openRightRail\}/);
  assert.match(board, /role="dialog"[\s\S]{0,120}aria-modal="true"/);
  assert.match(board, /aria-labelledby="canonical-right-rail-title"/);
  assert.match(board, /id="canonical-right-rail-title"/);
  assert.match(board, /ref=\{headerActionsToggleRef\}/);
  assert.match(board, /const getRightRailReturnFocusTarget = \(\) =>/);
  assert.match(board, /returnFocusTarget\?\.focus\(\)/);
  assert.match(
    board,
    /onClick=\{\(\) => closeRightRail\(\)\}\s+className="inline-flex min-h-10[^"]*"\s*>\s*닫기/,
  );
});

test("board overlays share complete dialog keyboard and focus behavior", () => {
  assert.match(board, /function AccessibleDialog\(/);
  assert.match(board, /role="dialog"[\s\S]{0,80}aria-modal="true"[\s\S]{0,80}aria-labelledby=\{ariaLabelledBy\}/);
  assert.match(board, /event\.key === "Escape"/);
  assert.match(board, /event\.key !== "Tab"/);
  assert.match(board, /dialogFocusableElements\(dialogRef\.current\)/);
  assert.match(board, /opener\?\.isConnected/);
  assert.match(board, /opener\.focus\(\)/);
  assert.match(board, /'audio\[controls\]'/);
  assert.match(board, /'video\[controls\]'/);
  assert.equal(board.match(/<AccessibleDialog/g)?.length, 5);
  assert.match(board, /ariaLabelledBy="attachment-viewer-title"/);
  assert.match(board, /ariaLabelledBy="view-card-dialog-title"/);
  assert.match(board, /ariaLabelledBy="edit-card-dialog-title"/);
  assert.match(board, /ariaLabelledBy="theme-dialog-title"/);
  assert.match(board, /ariaLabelledBy="rename-section-dialog-title"/);
  assert.match(board, /htmlFor="teacher-card-edit-text"/);
  assert.match(board, /id="teacher-card-edit-text"/);
  assert.match(board, /htmlFor="rename-section-input"/);
  assert.match(board, /id="rename-section-input"/);
  assert.match(board, /openCardEditor\(card, cardMenuTriggerRefs\.current\[card\.id\]\)/);
  assert.match(board, /openCardViewer\(card, cardMenuTriggerRefs\.current\[card\.id\]\)/);
  assert.match(board, /openRenameDialog\(\{ id: wall\.id, title: wall\.title \}, sectionMenuTriggerRefs\.current\[wall\.id\]\)/);
  assert.match(board, /openThemeDialog\(headerActionsToggleRef\.current \?\? event\.currentTarget\)/);
  assert.match(board, /getRightRailReturnFocusTarget\(\) \?\? event\.currentTarget/);
  assert.equal(board.match(/autoFocus/g)?.length, 2);
  assert.match(board, /z-\[10040\]/);
});

test("workshop CSS stays theme-scoped and restores board theme role pairs", () => {
  assert.match(workshop, /html\[data-gom-theme="gomdory-studio"\]/);
  assert.match(workshop, /\.workspace \.wallColumn[\s\S]*?background: var\(--theme-panel\);[\s\S]*?color: var\(--theme-text\);/);
  assert.match(workshop, /\.workspace \.cardSheet[\s\S]*?background: var\(--theme-card\);[\s\S]*?color: var\(--theme-text\);/);
  assert.match(workshop, /\[data-teacher-submission-panel\][\s\S]*?background: var\(--teacher-sheet\);/);
  assert.match(workshop, /\.toolPanel[\s\S]*?--theme-text: var\(--teacher-ink\);/);
  assert.match(workshop, /\.boardHeader[\s\S]*?backdrop-filter: none/);
  assert.match(workshop, /\.toolPanel[\s\S]*?backdrop-filter: none/);
  assert.match(workshop, /\.paperMenu[\s\S]*?--teacher-sheet: #fffdf7;/);
  assert.match(workshop, /\.paperMenu :global\(\.teacher-board-menu-item\)/);
  assert.match(board, /role="menuitem"[\s\S]{0,260}className=\{cardMenuItemClass\}>이름 바꾸기/);
  assert.match(board, /role="menuitem"[\s\S]{0,220}className=\{cardMenuDangerItemClass\}>삭제/);
  assert.doesNotMatch(workshop, /(^|\})\s*\.workspace\s*\{/m);
});

test("lesson drawer badges stay readable on the paper surface", () => {
  assert.match(board, /aria-pressed=\{vibeFilter === id\}/);
  assert.match(board, /bg-\[var\(--theme-surface-muted\)\].*text-\[var\(--theme-text\)\]/);
  assert.match(board, /text-\[var\(--theme-accent\)\].*underline-offset-2/);
  assert.doesNotMatch(board, /vibeFilter===id \? "border-cyan-300 text-cyan-100"/);
  assert.doesNotMatch(board, /rounded bg-slate-800 px-1\.5 py-0\.5/);
});
