import assert from "node:assert/strict";
import test from "node:test";

import { CSV_ROSTER_ISSUE_CODES } from "@/lib/roster/csvRosterIssueCodes";
import { buildPrivacySafeRosterCsvTemplate } from "@/lib/roster/csvRosterTemplate";

test("issue code catalog exports expected stable codes", () => {
  assert.equal(CSV_ROSTER_ISSUE_CODES.includes("invalid_role"), true);
  assert.equal(CSV_ROSTER_ISSUE_CODES.includes("sensitive_column_detected"), true);
  assert.equal(CSV_ROSTER_ISSUE_CODES.includes("duplicate_external_id"), true);
});

test("template generator returns privacy-safe Korean CSV", () => {
  const csv = buildPrivacySafeRosterCsvTemplate();
  assert.match(csv, /학급명,역할,표시명,외부ID/);
  assert.equal(/[\n\r](전화번호|주소|생년월일|주민|보호자|guardian|@)/.test(csv), false);
});
