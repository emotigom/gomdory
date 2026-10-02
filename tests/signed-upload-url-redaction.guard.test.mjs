import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const smokeTestPath = path.join(process.cwd(), "scripts", "smoke-test.js");
assert.equal(fs.existsSync(smokeTestPath), true, "expected repository source scripts/smoke-test.js");
const smokeSource = fs.readFileSync(smokeTestPath, "utf8");

test("smoke upload logs do not print raw signed uploadUrl", () => {
  assert.equal(smokeSource.includes("uploadUrl: maskSensitiveUrl(uploadUrl)"), false);
  assert.match(smokeSource, /uploadTarget: summarizeSignedUploadUrl\(uploadUrl, \{ objectKey: uploadObjectKey \}\)/);
});

test("signed query keys are always redacted", () => {
  for (const key of ["X-Amz-Signature", "X-Amz-Credential", "X-Amz-Date", "X-Amz-SignedHeaders"]) {
    assert.match(smokeSource, new RegExp(`"${key}"\\s*:\\s*[^\\n]*"\\[REDACTED\\]"`));
  }
});
