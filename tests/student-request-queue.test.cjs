const assert = require("node:assert/strict");
const test = require("node:test");

const { canSend, buildActionPayload } = require("../lib/student/actions.logic.cjs");

test("canSend respects cooldown window", () => {
  assert.equal(canSend(1000, null, 5000), true);
  assert.equal(canSend(6000, 1000, 5000), true);
  assert.equal(canSend(5000, 1000, 5000), false);
});

test("buildActionPayload maps help and pulse metadata", () => {
  const helpPayload = buildActionPayload({
    type: "help",
    meta: { reason: "too_fast" },
  });
  assert.equal(helpPayload.reason, "too_fast");

  const pulsePayload = buildActionPayload({
    type: "pulse",
    meta: { value: 3 },
  });
  assert.equal(pulsePayload.pulseValue, 3);
});
