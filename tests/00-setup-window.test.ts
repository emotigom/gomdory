import assert from "node:assert/strict";
import test from "node:test";

test("setup test environment", () => {
  assert.equal(globalThis.IS_REACT_ACT_ENVIRONMENT, true);
  assert.ok(globalThis.HTMLIFrameElement);
});
