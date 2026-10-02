import assert from "node:assert/strict";
import test from "node:test";

import { generateLicenseCode, hashCode, hintFromCode } from "@/lib/billing/licenseKeys";

test("generateLicenseCode returns code with expected prefix", () => {
  const code = generateLicenseCode();
  assert.match(code, /^GKD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test("hashCode normalizes casing and trims", async () => {
  const code = "  gkd-abcd-efgh-ijkl  ";
  const hashed = await hashCode(code);
  const hashedUpper = await hashCode(code.toUpperCase());
  assert.equal(hashed, hashedUpper);
  assert.equal(hashed.length, 64);
});

test("hintFromCode exposes last four characters only", () => {
  const code = "GKD-ABCD-EFGH-IJKL";
  const hint = hintFromCode(code);
  assert.equal(hint, "***-IJKL");
});
