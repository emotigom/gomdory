import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "app", "s", "[code]", "_components", "StudentBoardMinimal.tsx"),
  "utf8",
);
const wallSource = fs.readFileSync(
  path.join(process.cwd(), "app", "_components", "WallColumn.tsx"),
  "utf8",
);
const globalsSource = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

test("bright theme runtime guard removes board-level dim/tint overlays", () => {
  assert.match(source, /const isBrightTheme = resolvedThemeId === "bright";/);
  assert.match(source, /const shouldRenderBoardDimLayer = !isBrightTheme && boardDimOpacity > 0;/);
  assert.match(source, /data-page-marker="student-board"[\s\S]*data-testid="student-board-root"/);
  assert.match(source, /data-testid="student-board-root"/);
  assert.match(source, /data-current-view-theme=\{resolvedThemeId\}/);
  assert.match(source, /data-testid="student-board-scroll-surface"/);
  assert.match(source, /data-testid="student-board-background"/);
  assert.match(source, /const boardBackgroundStyle = wallpaperUrl[\s\S]*backgroundImage: `url\(\$\{wallpaperUrl\}\)`/);
  assert.doesNotMatch(source, /backgroundImage:[^\n]*linear-gradient/i);
});

test("student expanded topbar uses quiet workshop sections", () => {
  assert.match(source, /data-student-topbar-workbench="true"/);
  assert.match(source, /data-student-topbar-section="identity"/);
  assert.match(source, /data-student-topbar-section="status"/);
  assert.match(source, /data-student-topbar-section="tools"/);
  assert.match(source, /aria-label="보기 테마 선택"/);
  assert.match(source, /onChange=\{\(event\) => onChangeGuestViewTheme\(normalizeGuestViewThemeId\(event\.target\.value\)\)\}/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-student-topbar-section\][\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
  );
});

test("student advanced context menus use the scoped workshop surface", () => {
  assert.match(source, /data-student-context-menu="column"/);
  assert.match(source, /data-student-context-menu="card"/);
  assert.match(source, /role="menu"[\s\S]*?aria-label="컬럼 컨텍스트 메뉴"/);
  assert.match(source, /role="menu"[\s\S]*?aria-label="카드 컨텍스트 메뉴"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-student-context-menu\][\s\S]*?border-radius: 4px;[\s\S]*?box-shadow: 0 5px 14px/,
  );
});

test("student card edit actions keep a quiet scoped hierarchy", () => {
  assert.match(source, /data-student-card-edit-action="close-header"/);
  assert.match(source, /data-student-card-edit-action="attach"/);
  assert.match(source, /data-student-card-edit-action="remove-pending"/);
  assert.match(source, /data-student-card-edit-action="delete"/);
  assert.match(source, /data-student-card-edit-action="cancel"/);
  assert.match(source, /data-student-card-edit-action="save"/);
  assert.match(
    globalsSource,
    /\[data-testid="student-card-edit-dialog"\][\s\S]*?\[data-student-card-edit-action\][\s\S]*?border-radius: 2px;[\s\S]*?box-shadow: none;/,
  );
});

test("student card edit dialog uses a scoped paper editing surface", () => {
  assert.match(source, /data-testid="student-card-edit-dialog"/);
  assert.match(source, /data-student-card-edit-field="content"/);
  assert.match(source, /data-student-card-edit-field="url"/);
  assert.match(source, /data-student-card-edit-file="pending"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-testid="student-card-edit-dialog"\][\s\S]*?border-top: 3px solid var\(--student-wall-blue\);[\s\S]*?border-radius: 4px;[\s\S]*?box-shadow: 0 8px 24px/,
  );
  assert.match(
    globalsSource,
    /\[data-testid="student-card-edit-dialog"\][\s\S]*?\[data-student-card-edit-file="pending"\][\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
  );
});

test("mobile compose bar keeps the workshop surface on touch screens", () => {
  assert.match(source, /data-testid="student-mobile-compose-bar"/);
  assert.match(source, /disabled=\{writeLocked \|\| composeWalls\.length === 0\}/);
  assert.match(source, /aria-label="카드 작성 \(단축키 C\)"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-testid="student-mobile-compose-bar"\][\s\S]*?border-left: 4px solid var\(--student-wall-blue\);[\s\S]*?border-radius: 4px;[\s\S]*?backdrop-filter: none;/,
  );
});

test("today lesson kit uses scoped notes instead of repeated cards", () => {
  assert.match(source, /data-testid="today-lesson-kit-panel"/);
  assert.match(source, /data-today-lesson-kit-note="true"/);
  assert.match(source, /data-today-lesson-kit-item="true"/);
  assert.match(source, /data-today-lesson-kit-concepts="true"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-testid="today-lesson-kit-panel"\]\[data-state="expanded"\][\s\S]*?border-top: 3px solid var\(--student-wall-blue\);/,
  );
  assert.match(
    globalsSource,
    /\[data-testid="today-lesson-kit-panel"\][\s\S]*?\[data-today-lesson-kit-item="true"\][\s\S]*?border-top: 2px solid var\(--student-wall-blue\);[\s\S]*?border-radius: 2px;[\s\S]*?box-shadow: none;/,
  );
});

test("student artwork helper uses a scoped workshop paper surface", () => {
  assert.match(source, /data-testid="artwork-submission-helper-panel"/);
  assert.match(source, /data-artwork-submission-helper-option="true"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-public-guest-board="modern-hud"\][\s\S]*?\[data-testid="artwork-submission-helper-panel"\][\s\S]*?border-top: 3px solid var\(--student-wall-blue\);[\s\S]*?border-radius: 4px;[\s\S]*?backdrop-filter: none;/,
  );
  assert.match(
    globalsSource,
    /\[data-testid="artwork-submission-helper-panel"\][\s\S]*?\[data-artwork-submission-helper-option="true"\][\s\S]*?border-left: 3px solid var\(--student-wall-blue\);[\s\S]*?border-radius: 2px;[\s\S]*?box-shadow: none;/,
  );
});

test("student board success root keeps smoke marker for empty boards", () => {
  assert.match(source, /data-page-marker="student-board"[\s\S]*data-testid="student-board-root"/);
  assert.match(source, /columns\.length === 0/);
  assert.match(source, /data-testid="student-board-empty-state"/);
  assert.match(source, /선생님이 활동 공간을 준비하고 있어요/);
  assert.match(source, /새 칸이 열리면 바로 참여할 수 있어요\. 잠시만 기다려 주세요\./);
  assert.match(source, /사진이나 파일도 함께 올릴 수 있어요\./);
  assert.doesNotMatch(source, /data-page-marker="student-board-error"/);
});

test("dev-only computed-style diagnostics are available", () => {
  assert.match(source, /if \(process\.env\.NODE_ENV === "production" \|\| typeof window === "undefined"\) return;/);
  assert.match(source, /console\.debug\("\[student-board-theme-debug\]"/);
  assert.match(source, /console\.table\(/);
  assert.match(source, /parentChain/);
});

test("student work wall keeps explicit card role markers", () => {
  assert.match(wallSource, /data-student-card=\{/);
  assert.match(wallSource, /card\.student\.isOwnCard[\s\S]*\? "own"/);
  assert.match(wallSource, /card\.author_type === "teacher"[\s\S]*\? "teacher"/);
  assert.match(wallSource, /: "peer"/);
});

test("student work wall reserves a clear first-card space", () => {
  assert.match(wallSource, /data-testid="guest-card-compose-hint"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-testid="guest-card-compose-hint"\][\s\S]*?border-left: 3px solid var\(--student-wall-blue\);/,
  );
});

test("student work wall separates the card note from its author line", () => {
  assert.match(wallSource, /data-student-card-meta="true"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-student-card-meta\][\s\S]*?border-top: 1px solid color-mix/,
  );
});

test("student work wall keeps the own-card menu trigger quiet", () => {
  assert.match(wallSource, /aria-label="카드 옵션"/);
  assert.match(wallSource, /data-student-card-menu-trigger="true"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-student-card="own"\][\s\S]*?\[data-student-card-menu-trigger="true"\][\s\S]*?background: var\(--theme-more-button-bg\) !important;[\s\S]*?box-shadow: none;/,
  );
});

test("student work wall keeps the owner mark as a compact paper label", () => {
  assert.match(wallSource, /data-testid="student-owned-card-badge"/);
  assert.match(
    globalsSource,
    /html\[data-gom-theme="gomdory-studio"\][\s\S]*?\[data-testid="student-owned-card-badge"\][\s\S]*?border-radius: 2px;/,
  );
});
