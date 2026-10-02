const assert = require("node:assert/strict");
const test = require("node:test");

const { parseCreateBoardPayload } = require("../lib/ops/dashboardBoardsValidation.cjs");

test("parseCreateBoardPayload rejects invalid json", () => {
  const result = parseCreateBoardPayload("{");

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_json");
});

test("parseCreateBoardPayload rejects empty title", () => {
  const result = parseCreateBoardPayload(JSON.stringify({ title: "   " }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_title");
});
