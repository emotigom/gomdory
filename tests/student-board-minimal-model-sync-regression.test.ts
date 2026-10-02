import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const file = path.join(process.cwd(), "app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
const source = fs.readFileSync(file, "utf8");

test("student board defers model column sync while move is pending", () => {
  assert.match(source, /lastAppliedModelColumnsRef/);
  assert.match(source, /deferredModelColumnsRef/);
  assert.match(source, /if \(movePendingCount > 0 \|\| draggingCardId\) \{\s*deferredModelColumnsRef\.current = nextModelColumns;/s);
});

test("student board applies deferred model columns only after pending move ends", () => {
  assert.match(source, /const deferredModelColumns = deferredModelColumnsRef\.current/);
  assert.match(source, /if \(movePendingCount > 0 \|\| draggingCardId\) return;/);
  assert.match(source, /applyServerColumns\(deferredModelColumns, \{ markModelPropsApplied: true \}\);/);
});

test("student board rollback resync is guarded to one refresh schedule", () => {
  assert.match(source, /if \(moveFailureResyncRef\.current\) return;/);
  assert.match(source, /moveFailureResyncRef\.current = true;/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*window\.dispatchEvent\(new Event\(STUDENT_BOARD_SYNC_EVENT\)\);\s*moveFailureResyncRef\.current = false;/s);
});
