import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const FILE_PATH = path.join(process.cwd(), "app/_components/BoardMiniMap.tsx");

test("minimap wrapper uses fixed bottom-left flex-col layout", () => {
  const content = fs.readFileSync(FILE_PATH, "utf8");

  assert.match(content, /fixed left-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+1.5rem\)\] z-50 flex flex-col items-start/);
  assert.doesNotMatch(content, /flex-col-reverse/);
});

test("minimap panel renders before trigger with viewport-safe width classes", () => {
  const content = fs.readFileSync(FILE_PATH, "utf8");

  const panelIndex = content.indexOf('data-testid="board-minimap-panel"');
  const triggerIndex = content.indexOf('data-testid="board-minimap-trigger"');
  assert.ok(panelIndex >= 0, "panel test id should exist");
  assert.ok(triggerIndex >= 0, "trigger test id should exist");
  assert.ok(panelIndex < triggerIndex, "panel DOM should be declared above trigger");

  assert.match(content, /className="max-w-\[calc\(100vw-2rem\)\] overflow-hidden/);
});
