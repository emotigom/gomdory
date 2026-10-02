import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeShowcaseText } from "@/lib/showcase/buildShowcaseSummary";
import { createShowcaseToken, maskTokenForLogs } from "@/lib/showcase/token";

test("createShowcaseToken returns url-safe tokens", () => {
  const token = createShowcaseToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 18);
  assert.ok(token.length <= 32);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("maskTokenForLogs hides middle portion", () => {
  assert.equal(maskTokenForLogs(""), "");
  assert.equal(maskTokenForLogs("abcdefghij"), "ab…ij");
  assert.equal(maskTokenForLogs("abcdefghijklmnopqrstuvwxyz"), "abcdef…wxyz");
});

test("sanitizeShowcaseText strips urls and masks PII", () => {
  const result = sanitizeShowcaseText("연락: teacher@example.com https://example.com");
  assert.ok(result);
  assert.equal(result?.includes("example.com"), false);
  assert.equal(result?.includes("teacher@example.com"), false);
});
