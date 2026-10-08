import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relPath: string) => fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
const canonicalPath = "app/_components/board/commands/CommandPalette.tsx";
const source = read(canonicalPath);

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

test("guard: Student Board imports the shared command owner and class paths stay compatibility shims", () => {
  const studentBoard = read("app/s/[code]/_components/StudentBoardMinimal.tsx");
  const commandShim = read("app/dashboard/boards/[boardId]/class/CommandPalette.tsx");
  const keyboardShim = read("app/dashboard/boards/[boardId]/class/KeyboardShortcutsOverlay.tsx");
  const hookShim = read("app/dashboard/boards/[boardId]/class/useCommandPalette.ts");

  for (const relPath of [
    "CommandPalette",
    "KeyboardShortcutsOverlay",
    "useCommandPalette",
  ]) {
    assert.ok(
      studentBoard.includes(`@/app/_components/board/commands/${relPath}`),
      `Student Board must import the shared ${relPath} owner directly.`,
    );
  }
  assert.doesNotMatch(
    studentBoard,
    /@\/app\/dashboard\/boards\/\[boardId\]\/class\/(?:CommandPalette|KeyboardShortcutsOverlay|useCommandPalette)/,
  );

  assert.match(
    commandShim,
    /export \{ default \} from "@\/app\/_components\/board\/commands\/CommandPalette";/,
  );
  assert.match(
    keyboardShim,
    /export \{ default \} from "@\/app\/_components\/board\/commands\/KeyboardShortcutsOverlay";/,
  );
  assert.match(
    hookShim,
    /from "@\/app\/_components\/board\/commands\/useCommandPalette";/,
  );
  assert.doesNotMatch(commandShim, /function CommandPalette|useEffect\(/);
  assert.doesNotMatch(keyboardShim, /function KeyboardShortcutsOverlay|useEffect\(/);
  assert.doesNotMatch(hookShim, /function useCommandPalette|useState\(/);
});
