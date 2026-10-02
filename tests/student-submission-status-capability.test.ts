import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBMISSION_STATUS_CAPABILITY_BYTES,
  createSubmissionStatusCapability,
  hashSubmissionStatusCapability,
  verifySubmissionStatusCapability,
} from "@/lib/student-apps/submissionStatusCapability";

test("submission status capabilities are unique 256-bit base64url values", () => {
  const first = createSubmissionStatusCapability();
  const second = createSubmissionStatusCapability();
  assert.equal(SUBMISSION_STATUS_CAPABILITY_BYTES, 32);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(second, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("submission status capability hashes are SHA-256 hex and verify canonically", () => {
  const raw = createSubmissionStatusCapability(() => new Uint8Array(32).fill(7));
  const hash = hashSubmissionStatusCapability(raw);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, raw);
  assert.equal(verifySubmissionStatusCapability(raw, hash), true);
  assert.equal(verifySubmissionStatusCapability(`${raw}x`, hash), false);
  assert.equal(verifySubmissionStatusCapability(raw, "bad"), false);
});
