import assert from "node:assert/strict";
import test from "node:test";

import { getKeyboardShortcutHelpItems } from "@/lib/ui/keyboardShortcuts";

test("getKeyboardShortcutHelpItems returns unique shortcut IDs", () => {
  const items = getKeyboardShortcutHelpItems();
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});
