const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeActionText, buildActionPayload } = require("../lib/student/actions.logic.cjs");

test("normalizeActionText trims and truncates", () => {
  const input = "  hello world  ";
  const output = normalizeActionText(input, 5);
  assert.equal(output, "hello");
});

test("buildActionPayload maps question payload", () => {
  const payload = buildActionPayload({
    id: "req-1",
    type: "question",
    text: "  질문이 있어요 ",
    anonId: "anon-1",
  });

  assert.equal(payload.type, "question");
  assert.equal(payload.text, "질문이 있어요");
  assert.equal(payload.anonId, "anon-1");
});
