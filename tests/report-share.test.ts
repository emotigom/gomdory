import assert from "node:assert/strict";
import test from "node:test";

import {
  generateReportShareToken,
  hashReportShareToken,
  isReportShareActive,
  isValidReportShareToken,
  maskReportShareToken,
} from "@/lib/data/sessionReportShares";

test("generateReportShareToken returns valid token", () => {
  const token = generateReportShareToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 64);
  assert.ok(isValidReportShareToken(token));
});

test("hashReportShareToken creates deterministic SHA-256 digest", async () => {
  const token = "abcdef123456";
  const otherToken = "abcdef123457";

  const [hashA, hashB, hashOther] = await Promise.all([
    hashReportShareToken(token),
    hashReportShareToken(token),
    hashReportShareToken(otherToken),
  ]);

  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashOther);
});

test("maskReportShareToken reveals only prefix", () => {
  assert.equal(maskReportShareToken("abcdef123456"), "ABCDEF••••");
  assert.equal(maskReportShareToken(""), "");
});

test("isReportShareActive respects revoke and expiry", () => {
  const now = Date.now();
  const activeShare = {
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
  const expiredShare = {
    expires_at: new Date(now - 60_000).toISOString(),
    revoked_at: null,
  };
  const revokedShare = {
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: new Date(now - 1000).toISOString(),
  };

  assert.equal(isReportShareActive(activeShare, now), true);
  assert.equal(isReportShareActive(expiredShare, now), false);
  assert.equal(isReportShareActive(revokedShare, now), false);
});
