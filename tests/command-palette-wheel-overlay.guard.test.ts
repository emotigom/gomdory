import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const relPath = "app/dashboard/boards/[boardId]/class/CommandPalette.tsx";
const source = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");

test("guard: command palette overlay must not use fullscreen click-catcher", () => {
  assert.match(
    source,
    /className="pointer-events-none fixed inset-0 z-50/,
    "Command palette shell must be pointer-events-none to avoid intercepting board background wheel events.",
  );

  assert.match(
    source,
    /className="pointer-events-none absolute inset-0 bg-black\/40"/,
    "Command palette backdrop must remain non-interactive.",
  );

  assert.doesNotMatch(
    source,
    /className="absolute inset-0 bg-black\/40"\s*\n\s*onClick=\{onClose\}/,
    "Command palette must not reintroduce a fullscreen backdrop click-catcher.",
  );
});
