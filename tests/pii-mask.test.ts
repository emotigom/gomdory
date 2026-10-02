import assert from "node:assert/strict";
import test from "node:test";

import { maskPii } from "@/lib/security/piiMask";

test("maskPii masks email, phone, and rrn", () => {
  const input = "이메일 test@example.com 전화 01012345678 주민 900101-1234567";
  const result = maskPii(input);

  assert.equal(result.text.includes("t***@e***.com"), true);
  assert.equal(result.text.includes("010-****-****"), true);
  assert.equal(result.text.includes("*******"), true);
  assert.deepEqual(result.hits.sort(), ["pii_email", "pii_phone", "pii_rrn"].sort());
});
