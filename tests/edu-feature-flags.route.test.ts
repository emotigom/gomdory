import assert from "node:assert/strict";
import test from "node:test";

import { buildJoinTokenSessionFeatureFlags } from "@/lib/edu/joinTokenSessionFeatureFlags";

test("feature-flags: join_token_session allowed case should not be auth_error/user_only", () => {
  const payload = buildJoinTokenSessionFeatureFlags({
    globalEnabled: true,
    downloadAllowed: true,
  });

  assert.equal(payload.webllmEnabled, true);
  assert.equal(payload.webllmDownloadAllowed, true);
  assert.equal(payload.reason, "join_token_session");
  assert.match(payload.reasons.join(","), /join_token_session/);
  assert.notEqual(payload.errorKind, "auth_error");
  assert.notEqual(payload.gatingMode, "user_only");
  assert.equal(payload.gatingMode, "join_token");
});
