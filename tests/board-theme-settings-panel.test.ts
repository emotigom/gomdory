import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(...parts: string[]) {
  return readFileSync(path.join(root, ...parts), "utf8");
}

test("board settings route normalizes and timestamps ui theme saves", () => {
  const source = read("app", "api", "v1", "boards", "[boardId]", "settings", "route.ts");

  assert.match(source, /normalizePersistedBoardTheme/);
  assert.match(source, /uiThemeConfig/);
  assert.match(source, /ui_theme_config/);
  assert.match(source, /if \(uiThemeConfig !== undefined\) \{/);
  assert.match(source, /ui_theme_updated_at\s*=\s*\(deps\.nowFn\?\.\(\) \?\? new Date\(\)\)\.toISOString\(\)/);
  assert.match(source, /invalid_theme_config/);
  assert.match(source, /uiThemeConfig\s*===\s*undefined/);
});

test("source-level smoke guard: teacher theme panel previews before save and rolls back on close or failure", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");

  assert.match(source, /BOARD_THEME_PRESETS/);
  assert.match(source, /setPreviewBoardTheme\(theme\)/);
  assert.match(source, /style=\{boardRuntimeStyle\}/);
  assert.match(source, /setPreviewBoardTheme\(savedBoardTheme\)/);
  assert.match(source, /patch:\s*\{\s*uiThemeConfig:\s*theme\s*\}/);
  assert.match(source, /setSavedBoardTheme\(savedTheme\)/);
  assert.match(source, /setPreviewBoardTheme\(savedTheme\)/);
  assert.match(source, /setThemeModalOpen\(false\)/);
  assert.match(source, /기본 테마로 되돌리기/);
  assert.doesNotMatch(source, /StudentBoardMinimal/);
});

test("source-level smoke guard: teacher theme panel exposes smoke-testable controls but does not replace browser QA", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");

  assert.match(source, /data-testid="board-theme-settings-panel"/);
  assert.match(source, /data-testid=\{`board-theme-preset-\$\{preset\.id\}`\}/);
  assert.match(source, /BOARD_THEME_PRESET_LABELS\[preset\.id\]/);
  assert.match(source, /data-testid="board-theme-save"/);
  assert.match(source, /onClick=\{\(\) => onSave\(selectedTheme\)\}/);
  assert.match(source, /data-testid="board-theme-cancel"/);
  assert.match(source, /onClick=\{onResetPreview\}/);
  assert.match(source, /data-testid="board-theme-restore-default"/);
  assert.match(source, /onClick=\{\(\) => onSave\(DEFAULT_BOARD_THEME\)\}/);
  assert.match(source, /data-testid="board-theme-mobile-open"/);
  assert.match(source, /<AccessibleDialog[\s\S]*?testId="board-theme-mobile-modal"/);
  assert.match(source, /data-testid=\{testId\}/);
  assert.match(source, /onClose=\{closeThemeDialog\}/);
  assert.match(source, /openerRef=\{themeDialogOpenerRef\}/);
});

test("public share page reads stored board theme dynamically", () => {
  const source = read("app", "s", "[code]", "page.tsx");

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /export const revalidate = 0/);
  assert.match(source, /normalizePersistedBoardTheme\(board\.ui_theme_config\) \?\? DEFAULT_BOARD_THEME/);
  assert.match(source, /boardTheme: persistedBoardTheme/);
});
