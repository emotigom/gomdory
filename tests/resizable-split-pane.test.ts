import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

test("ResizableSplitPane renders left/right panes with an accessible separator", () => {
  const splitPane = read(
    "components",
    "lesson-activities",
    "ResizableSplitPane.tsx",
  );

  assert.match(splitPane, /"use client"/);
  assert.match(splitPane, /left: ReactNode/);
  assert.match(splitPane, /right: ReactNode/);
  assert.match(splitPane, /data-testid="resizable-split-pane-left"/);
  assert.match(splitPane, /data-testid="resizable-split-pane-right"/);
  assert.match(splitPane, /role="separator"/);
  assert.match(splitPane, /aria-label=\{SEPARATOR_LABEL\}/);
  assert.match(splitPane, /편집기와 결과 창 크기 조절/);
  assert.match(splitPane, /aria-orientation="vertical"/);
  assert.match(splitPane, /aria-valuemin=\{min\}/);
  assert.match(splitPane, /aria-valuemax=\{max\}/);
  assert.match(splitPane, /aria-valuenow=\{leftPercent\}/);
});

test("ResizableSplitPane supports drag, touch-sized handle, keyboard resize, reset, and safe local storage", () => {
  const splitPane = read(
    "components",
    "lesson-activities",
    "ResizableSplitPane.tsx",
  );

  assert.match(splitPane, /onPointerDown=\{handlePointerDown\}/);
  assert.match(splitPane, /pointermove/);
  assert.match(splitPane, /pointerup/);
  assert.match(splitPane, /touch-none/);
  assert.match(splitPane, /w-4 cursor-col-resize/);
  assert.match(splitPane, /event\.key === "ArrowLeft"/);
  assert.match(splitPane, /event\.key === "ArrowRight"/);
  assert.match(splitPane, /KEYBOARD_STEP_PERCENT = 2/);
  assert.match(splitPane, /onDoubleClick=\{resetToDefault\}/);
  assert.match(splitPane, /window\.localStorage\.getItem\(storageKey\)/);
  assert.match(splitPane, /window\.localStorage\.setItem\(storageKey/);
  assert.match(splitPane, /catch \{/);
  assert.match(splitPane, /grid-cols-1/);
  assert.match(splitPane, /lg:\[grid-template-columns:minmax\(360px,var\(--resizable-split-left\)\)_16px_minmax\(320px,1fr\)\]/);
  assert.match(splitPane, /hidden min-h-full w-4/);
  assert.match(splitPane, /overflow-x-clip/);
});
