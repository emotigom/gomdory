import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "_components", "WallColumn.tsx"), "utf8");
const anchoredMenu = fs.readFileSync(path.join(process.cwd(), "app", "_components", "AnchoredMenu.tsx"), "utf8");
const dismissableLayer = fs.readFileSync(
  path.join(process.cwd(), "app", "_components", "useDismissableLayer.ts"),
  "utf8",
);
const styles = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
const cardColors = fs.readFileSync(path.join(process.cwd(), "lib", "ui", "cardColors.ts"), "utf8");
const studentMenu = source.slice(
  source.indexOf("function StudentOwnedCardMenu"),
  source.indexOf("const sectionMenuButtonClass"),
);

test("student card menu only renders for own cards and closes on Escape/outside", () => {
  assert.match(source, /\{card\.student\?\.isOwnCard \? \(/);
  assert.match(studentMenu, /useDismissableLayer\(\{/);
  assert.match(dismissableLayer, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(dismissableLayer, /shouldDismissOnKeyDown\(event\)/);
  assert.match(dismissableLayer, /return event\.key === "Escape"/);
});

test("student own card menu exposes edit before delete", () => {
  assert.match(source, /card\.student\?\.onEdit\?\.\(\)/);
  assert.match(source, /수정/);
  assert.match(source, /card\.student\?\.onDelete\?\.\(\)/);
  assert.match(source, /삭제/);
});

test("student card option button blocks during drag and duplicate delete clicks", () => {
  assert.match(studentMenu, /const actionsDisabled = Boolean\(draggingCardId\) \|\| card\.student\?\.deleting/);
  assert.match(studentMenu, /disabled=\{actionsDisabled\}/);
  assert.match(studentMenu, /if \(draggingCardId \|\| card\.student\?\.deleting\) return/);
  assert.match(studentMenu, /Boolean\(draggingCardId\)[\s\S]*option\.isCurrent[\s\S]*card\.student\?\.deleting/);
});

test("student card option trigger uses CSS dots and dedicated theme tokens", () => {
  const trigger = source.slice(
    source.indexOf('data-student-card-menu-trigger="true"'),
    source.indexOf('data-student-card-menu-popup="true"'),
  );
  assert.match(source, /data-student-card-menu-trigger="true"/);
  assert.match(source, /aria-label="카드 옵션"/);
  assert.match(studentMenu, /aria-expanded=\{isOpen\}/);
  assert.match(studentMenu, /aria-haspopup="menu"/);
  assert.doesNotMatch(trigger, /⋯/);
  assert.equal((trigger.match(/h-1 w-1 rounded-full bg-current/g) ?? []).length, 3);
  assert.match(source, /background: "var\(--theme-more-button-bg, var\(--theme-card-strong, var\(--theme-card\)\)\)"/);
  assert.match(source, /color: "var\(--theme-more-button-text, var\(--theme-card-text, var\(--theme-text\)\)\)"/);
  assert.match(source, /borderColor: "var\(--theme-more-button-border, var\(--theme-border\)\)"/);
  assert.match(styles, /\[data-student-card-menu-trigger="true"\][\s\S]*background: var\(--theme-more-button-bg/);
  assert.match(styles, /\[data-student-card-menu-trigger="true"\]:not\(:disabled\):hover[\s\S]*--theme-more-button-hover-bg/);
});

test("student card menu isolates its surface and readable item colors", () => {
  const popup = source.slice(source.indexOf('data-student-card-menu-popup="true"'));
  assert.match(source, /data-student-card-menu-popup="true"/);
  assert.match(studentMenu, /<AnchoredMenu/);
  assert.match(studentMenu, /align="right"/);
  assert.match(studentMenu, /role="menu"/);
  assert.match(studentMenu, /min-w-\[220px\]/);
  assert.doesNotMatch(studentMenu, /absolute right-0 top-9 z-30/);
  assert.match(source, /background: "var\(--theme-menu-bg, var\(--theme-card-strong, var\(--theme-card\)\)\)"/);
  assert.match(source, /color: "var\(--theme-menu-text, var\(--theme-card-text, var\(--theme-text\)\)\)"/);
  assert.match(source, /borderColor: "var\(--theme-menu-border, var\(--theme-border\)\)"/);
  assert.match(source, /isolation: "isolate"/);
  assert.match(source, /opacity: 1/);
  assert.match(source, /filter: "none"/);
  assert.match(styles, /\[data-student-card-menu-popup="true"\][\s\S]*background: var\(--theme-menu-bg/);
  assert.match(source, /text-\[var\(--theme-menu-text\)\]/);
  assert.match(source, /text-\[var\(--theme-menu-muted-text\)\]/);
  assert.match(source, /text-\[var\(--theme-menu-danger-text\)\]/);
  assert.match(source, /hover:bg-\[var\(--theme-menu-danger-hover-bg\)\]/);
  assert.doesNotMatch(popup, /disabled:opacity-80/);
});

test("student card portal copies board theme variables from its trigger without global writes", () => {
  for (const variableName of [
    "--theme-menu-bg",
    "--theme-menu-text",
    "--theme-menu-muted-text",
    "--theme-menu-border",
    "--theme-menu-hover-bg",
    "--theme-menu-danger-text",
    "--theme-menu-danger-hover-bg",
    "--theme-focus",
    "--theme-card",
    "--theme-text",
  ]) {
    assert.match(source, new RegExp(`"${variableName}"`));
  }
  assert.match(studentMenu, /cssVariableSourceRef=\{triggerRef\}/);
  assert.match(studentMenu, /cssVariableNames=\{STUDENT_CARD_MENU_CSS_VARIABLES\}/);
  assert.match(anchoredMenu, /window\.getComputedStyle\(source\)/);
  assert.match(anchoredMenu, /menu\.style\.setProperty\(variableName, value\)/);
  assert.doesNotMatch(anchoredMenu, /document\.(?:body|documentElement)\.style\.setProperty/);
});

test("student card menu uses a fixed body portal above card stacking and column overflow", () => {
  assert.match(anchoredMenu, /createPortal\(/);
  assert.match(anchoredMenu, /document\.body/);
  assert.match(anchoredMenu, /position: "fixed"/);
  assert.match(anchoredMenu, /z-\[9999\] overflow-y-auto/);
  assert.match(anchoredMenu, /getBoundingClientRect\(\)/);
  assert.match(anchoredMenu, /window\.addEventListener\("scroll", handleUpdate, true\)/);
});

test("portal clicks stay inside ref-based trigger and menu dismissal boundaries", () => {
  assert.match(studentMenu, /const triggerRef = useRef<HTMLButtonElement \| null>\(null\)/);
  assert.match(studentMenu, /const menuRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(studentMenu, /anchorRef: triggerRef/);
  assert.match(studentMenu, /layerRef: menuRef/);
  assert.match(studentMenu, /anchorRef=\{triggerRef\}/);
  assert.match(studentMenu, /menuRef=\{menuRef\}/);
  assert.match(dismissableLayer, /boundaryElements:[\s\S]*layerRef\.current/);
  assert.match(dismissableLayer, /anchorElement: anchorRef\.current/);
});

test("card color surface overrides do not replace menu or more-button tokens", () => {
  assert.doesNotMatch(cardColors, /--theme-menu-/);
  assert.doesNotMatch(cardColors, /--theme-more-button-/);
});
