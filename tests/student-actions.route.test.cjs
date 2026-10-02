const assert = require("node:assert/strict");
const test = require("node:test");

const { buildActionPayload, parseRateLimitError } = require("../lib/student/actions.logic.cjs");

test("buildActionPayload maps poll vote payload", () => {
  const payload = buildActionPayload({
    id: "req-poll",
    type: "poll",
    meta: { pollId: "poll-1", optionId: "opt-1" },
    anonId: "anon-2",
  });

  assert.equal(payload.type, "poll_vote");
  assert.equal(payload.pollId, "poll-1");
  assert.equal(payload.optionId, "opt-1");
  assert.equal(payload.anonId, "anon-2");
});

test("parseRateLimitError returns cooldown message", () => {
  const result = parseRateLimitError({
    status: 429,
    payload: { retryAfterSeconds: 4 },
    now: 1000,
  });

  assert.ok(result);
  assert.equal(result.retryAfterSeconds, 4);
  assert.equal(result.retryAfterAt, 5000);
  assert.equal(result.message, "잠시 후 다시 시도해주세요 (약 4초)");
});
