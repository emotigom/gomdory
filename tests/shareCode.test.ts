import assert from "node:assert/strict";
import test from "node:test";

import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";

test("normalizeShareCode trims, lowers, and strips invalid characters", () => {
  assert.equal(normalizeShareCode(" EB2V8Q "), "eb2v8q");
});

test("isLikelyShareCode accepts short share-like codes", () => {
  assert.equal(isLikelyShareCode("eb2v8q"), true);
});

test("isLikelyShareCode rejects reserved paths", () => {
  assert.equal(isLikelyShareCode("dashboard"), false);
});
