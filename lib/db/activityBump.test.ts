import assert from "node:assert/strict";
import test from "node:test";

import { shouldBumpActivity } from "@/lib/db/activityBump";

test("shouldBumpActivity returns true for supported action types", () => {
  assert.equal(shouldBumpActivity("cardCreate"), true);
  assert.equal(shouldBumpActivity("cardUpdateText"), true);
  assert.equal(shouldBumpActivity("cardUpdateUrl"), true);
  assert.equal(shouldBumpActivity("cardUpdateColor"), true);
  assert.equal(shouldBumpActivity("cardUpdateStatus"), true);
  assert.equal(shouldBumpActivity("attachmentLink"), true);
  assert.equal(shouldBumpActivity("attachmentUnlink"), true);
});
