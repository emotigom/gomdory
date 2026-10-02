import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policy = fs.readFileSync("lib/uploads/cardAttachmentPolicy.ts", "utf8");
const browser = fs.readFileSync("tests/browser/q4-student-card-compose-semantic-feedback.spec.mjs", "utf8");

test("Q4 oversized attachment fixture follows the canonical policy boundary", () => {
  assert.match(policy, /DEFAULT_CARD_ATTACHMENT_MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.match(policy, /if \(input\.sizeBytes > maxBytes\)/);
  assert.match(browser, /const maxBytes = 50 \* 1024 \* 1024/);
  assert.match(browser, /file\.size !== size \+ 1/);
  assert.doesNotMatch(browser, /11 \* 1024 \* 1024/);
});
