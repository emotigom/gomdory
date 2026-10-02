import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const join = fs.readFileSync("app/_components/JoinByCode.tsx", "utf8");
const page = fs.readFileSync("app/s/page.tsx", "utf8");

test("student entry classifies known server errors before rendering JoinByCode", () => {
  assert.match(page, /type JoinErrorKind = "code-field" \| "form" \| undefined/);
  assert.match(page, /missing_code" \|\| error === "invalid_code"\) return "code-field"/);
  assert.match(page, /turnstile_failed" \|\| error === "class_locked"\) return "form"/);
  assert.match(page, /errorKind=\{resolveJoinErrorKind\(error\)\}/);
});

test("student entry field association has one current error node and a stable help fallback", () => {
  assert.match(join, /id="student-code-help"/);
  assert.match(join, /id="student-code-error"/);
  assert.match(join, /aria-invalid=\{activeCodeError \? true : undefined\}/);
  assert.match(join, /aria-describedby=\{codeDescribedBy\}/);
  assert.match(join, /student-code-help student-code-error/);
  assert.match(join, /setLocalCodeError\(null\);/);
  assert.match(join, /setInitialCodeErrorDismissed\(true\);/);
  assert.doesNotMatch(join, /role="alert"[\s\S]{0,500}student-code-error/);
});

test("student entry separates form failures and guards terminal navigation from duplicate submission", () => {
  assert.match(join, /id="student-entry-form-error"/);
  assert.match(join, /submitLockedRef\.current/);
  assert.match(join, /if \(submitLockedRef\.current\) return;/);
  assert.doesNotMatch(join, /finally \{[\s\S]{0,160}setIsSubmitting\(false\)/);
});
