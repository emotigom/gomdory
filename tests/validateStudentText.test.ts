import assert from "node:assert/strict";
import test from "node:test";

import { validateStudentText } from "@/lib/safety/validateStudentText";

test("validateStudentText masks phone and email", () => {
  const result = validateStudentText("연락처 010-1234-5678 / kid@example.com", { maxLength: 200, minLength: 1 });
  assert.equal(result.text.includes("010-****-****"), true);
  assert.equal(result.text.includes("kid@example.com"), false);
});

test("validateStudentText can preserve card body URLs while still masking other PII", () => {
  const result = validateStudentText("자료 https://example.com/a 연락처 010-1234-5678", {
    maxLength: 200,
    minLength: 1,
    maskUrls: false,
  });
  assert.equal(result.text.includes("https://example.com/a"), true);
  assert.equal(result.text.includes("[링크]"), false);
  assert.equal(result.text.includes("010-****-****"), true);
});
