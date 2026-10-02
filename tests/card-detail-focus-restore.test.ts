import test from "node:test";
import assert from "node:assert/strict";

import { buildCardFocusSelector, pickFocusRestoreCardId } from "@/app/_components/cards/focusRestore";

test("pickFocusRestoreCardId chooses the first available candidate", () => {
  assert.equal(pickFocusRestoreCardId(["c-2", "c-1"], ["c-1", "c-2"]), "c-2");
  assert.equal(pickFocusRestoreCardId(["missing", "c-1"], ["c-1", "c-2"]), "c-1");
  assert.equal(pickFocusRestoreCardId([null, undefined, "x"], ["c-1"]), null);
});

test("buildCardFocusSelector targets data-card-id marker", () => {
  assert.equal(buildCardFocusSelector("card-42"), '[data-card-id="card-42"]');
});
