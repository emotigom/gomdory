import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeStudentText } from "@/lib/security/sanitizeStudentText";

test("masks phone numbers and emails", () => {
  const { text, reasons } = sanitizeStudentText("제 번호는 010-1234-5678 이고 메일은 kid@example.com", { maxLength: 280 });
  assert.equal(text.includes("010-****-****"), true);
  assert.equal(text.includes("kid@example.com"), false);
  assert.ok(reasons.includes("pii_phone"));
  assert.ok(reasons.includes("pii_email"));
});

test("removes links from input", () => {
  const { text, reasons } = sanitizeStudentText("이건 링크 http://example.com 같이 보여요");
  assert.equal(text.includes("http"), false);
  assert.ok(reasons.includes("url_removed"));
});

test("masks profanity and flags", () => {
  const { text, flagged, reasons } = sanitizeStudentText("This is shit content");
  assert.equal(flagged, true);
  assert.ok(text.includes("****"));
  assert.ok(reasons.includes("profanity"));
});
