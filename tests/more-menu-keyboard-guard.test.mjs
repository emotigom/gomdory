import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "app", "_components", "MoreMenu.tsx"),
  "utf8",
);

test("MoreMenu opens as a named menu and focuses the first enabled item", () => {
  assert.match(source, /aria-controls=\{isOpen \? menuDomId : undefined\}/);
  assert.match(source, /menu\.setAttribute\("aria-label", triggerAriaLabel\)/);
  assert.match(source, /focusMenuItem\(getEnabledMenuItems\(menuRef\.current\), 0\)/);
  assert.match(source, /item\.setAttribute\("role", "menuitem"\)/);
  assert.match(source, /item\.getAttribute\("aria-disabled"\) === "true"/);
  assert.match(source, /item\.hasAttribute\("disabled"\) \|\| item\.matches\(":disabled"\)/);
});

test("MoreMenu implements wrapped arrow navigation and Home or End", () => {
  assert.match(source, /event\.key === "ArrowDown"/);
  assert.match(source, /\(currentIndex \+ 1\) % items\.length/);
  assert.match(source, /event\.key === "ArrowUp"/);
  assert.match(source, /currentIndex <= 0 \? items\.length - 1 : currentIndex - 1/);
  assert.match(source, /event\.key === "Home"/);
  assert.match(source, /event\.key === "End"/);
});

test("MoreMenu owns Escape focus restoration and deterministic Tab exit", () => {
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /closeMenu\(\);\s*restoreTriggerFocus\(\)/);
  assert.match(source, /event\.key === "Tab"/);
  assert.match(source, /getAdjacentFocusableFromTrigger/);
  assert.match(source, /event\.shiftKey \? -1 : 1/);
});

test("MoreMenu keeps its portal and dismissal contracts", () => {
  assert.match(source, /<AnchoredMenu/);
  assert.match(source, /boundaryRefs: \[wrapperRef, menuRef\]/);
  assert.match(source, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(source, /if \(!closeOnSelect\) return/);
  assert.match(source, /onClick=\{handleCloseOnSelect\}/);
});

test("MoreMenu keeps cross-menu side effects outside the state updater", () => {
  assert.match(source, /const next = !isOpen;\s*setIsOpen\(next\);/);
  assert.match(source, /setIsOpen\(next\);[\s\S]{0,220}window\.dispatchEvent/);
  assert.doesNotMatch(source, /setIsOpen\(\(prev\) => \{[\s\S]{0,260}window\.dispatchEvent/);
  assert.doesNotMatch(source, /setIsOpen\(\(prev\) => \{[\s\S]{0,260}onOpenChange/);
});
