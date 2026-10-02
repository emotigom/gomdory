import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("MoreMenu broadcasts global open event so only one contextual menu can stay open", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(source, /gomdory:more-menu-open/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\("gomdory:more-menu-open"/);
  assert.match(source, /if \(customEvent\.detail\?\.id === menuInstanceId\) return;/);
});

test("teacher board add-section affordance stays compact and intentional", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardMinimalClient.tsx");
  assert.match(source, /min-h-\[110px\]/);
  assert.doesNotMatch(source, /min-w-\[360px\]/);
});


test("MoreMenu registers and cleans up global listener for single-owner behavior", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(source, /window\.addEventListener\("gomdory:more-menu-open"/);
  assert.match(source, /return \(\) => window\.removeEventListener\("gomdory:more-menu-open"/);
});

test("MoreMenu exposes global close and keeps outside-click and escape dismissal in the layer", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  const layer = read("app", "_components", "useDismissableLayer.ts");
  assert.match(source, /window\.addEventListener\("gomdory:more-menu-close"/);
  assert.match(source, /window\.removeEventListener\("gomdory:more-menu-close"/);
  assert.match(layer, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(layer, /document\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(layer, /shouldDismissOnKeyDown\(event\)/);
});

test("MoreMenu dismissal is delegated to dismissable layer for escape/outside-click", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(source, /useDismissableLayer\(\{/);
  assert.match(source, /onDismiss: \(\) => onOpenChange\?\.\(false\)/);
});

test("MoreMenu directly dismisses outside pointerdown without blocking menu actions", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(source, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(source, /document\.removeEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(source, /menuRef\.current\?\.contains\(target\)/);
  assert.match(source, /triggerRef\.current\?\.contains\(target\)/);
  assert.doesNotMatch(source, /onClickCapture=\{handleCloseOnSelect/);
});

test("MoreMenu trigger/menu interactions stop propagation to parent cards", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(source, /onPointerDown=\{\(event\) => \{\s*event\.stopPropagation\(\)/s);
  assert.match(source, /onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\)/s);
});

test("MoreMenu closeOnSelect does not rely on capture-phase menu item dismissal", () => {
  const source = read("app", "_components", "MoreMenu.tsx");
  assert.match(
    source,
    /const\s+closeMenu\s*=\s*(?:\(\s*\)\s*=>\s*\{|useCallback\s*\(\s*\(\s*\)\s*=>\s*\{)/,
  );
  assert.match(
    source,
    /const\s+closeMenu\s*=\s*(?:\(\s*\)\s*=>\s*\{|useCallback\s*\(\s*\(\s*\)\s*=>\s*\{)\s*setIsOpen\(false\);\s*onOpenChange\?\.\(false\);/,
  );
  assert.match(source, /const handleCloseOnSelect = \(event: (?:ReactMouseEvent|React\.MouseEvent)<HTMLDivElement>\) => \{/);
  assert.match(source, /if \(!closeOnSelect\) return;/);
  assert.match(source, /closeMenu\(\);/);
  assert.match(source, /onClick=\{handleCloseOnSelect\}/);
  assert.doesNotMatch(source, /onClickCapture=\{handleCloseOnSelect/);
});

test("teacher card menu actions close explicitly and retain dialog focus targets", () => {
  const source = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardCanonicalClient.tsx",
  );
  assert.match(source, /const closeCardMenu = \(\) => \{/);
  assert.match(source, /gomdory:more-menu-close/);
  assert.match(source, /const runCardMenuAction = \(action: \(\) => void\) => \{/);
  assert.match(source, /runCardMenuAction\(\(\) => openCardEditor\(card, cardMenuTriggerRefs\.current\[card\.id\]\)\)/);
  assert.match(source, /runCardMenuAction\(\(\) => openCardViewer\(card, cardMenuTriggerRefs\.current\[card\.id\]\)\)/);
  assert.match(source, /runCardMenuAction\(\(\) => \{\s*void updateCardColor/s);
  assert.match(source, /runCardMenuAction\(\(\) => \{\s*cardFileInputs\.current\[card\.id\]\?\.click\(\);/s);
  assert.match(source, /runCardMenuAction\(\(\) => \{\s*void moveCardInSection\(wall\.id, card\.id, -1\);/s);
  assert.match(source, /runCardMenuAction\(\(\) => \{\s*void moveCardInSection\(wall\.id, card\.id, 1\);/s);
  assert.match(source, /runCardMenuAction\(\(\) => \{\s*void deleteCard\(card\.id\);/s);
});
