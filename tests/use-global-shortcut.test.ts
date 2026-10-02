import assert from "node:assert/strict";
import test from "node:test";

import { shouldIgnoreShortcutTarget } from "@/lib/ui/useGlobalShortcut";

function createElement({
  tagName,
  isContentEditable = false,
  closestResult = null,
}: {
  tagName: string;
  isContentEditable?: boolean;
  closestResult?: Element | null;
}) {
  return {
    tagName,
    isContentEditable,
    closest: () => closestResult,
  } as unknown as HTMLElement;
}

test("shouldIgnoreShortcutTarget returns true for editable tags", () => {
  assert.equal(shouldIgnoreShortcutTarget(createElement({ tagName: "INPUT" })), true);
  assert.equal(shouldIgnoreShortcutTarget(createElement({ tagName: "TEXTAREA" })), true);
  assert.equal(shouldIgnoreShortcutTarget(createElement({ tagName: "SELECT" })), true);
});

test("shouldIgnoreShortcutTarget returns true for contenteditable nodes", () => {
  assert.equal(shouldIgnoreShortcutTarget(createElement({ tagName: "DIV", isContentEditable: true })), true);
  assert.equal(
    shouldIgnoreShortcutTarget(createElement({ tagName: "SPAN", closestResult: {} as Element })),
    true,
  );
});

test("shouldIgnoreShortcutTarget returns false for non-editable targets", () => {
  assert.equal(shouldIgnoreShortcutTarget(createElement({ tagName: "BUTTON" })), false);
  assert.equal(shouldIgnoreShortcutTarget(null), false);
  assert.equal(shouldIgnoreShortcutTarget({} as EventTarget), false);
});
