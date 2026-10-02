import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("student submission status route source guard enforces trusted ownership", () => {
  const source = readFileSync("app/api/v1/student-apps/submissions/status/route.ts", "utf8");
  assert.match(source, /export async function POST/);
  assert.match(source, /getTrustedParticipantOwnershipContext/);
  assert.match(source, /parseSubmissionStatusRequest/);
  assert.match(source, /studentSessionToken\?: unknown; guestToken\?: unknown/);
  assert.match(source, /if \(!sessionToken\) return empty\(\)/);
  assert.match(source, /\.eq\("board_id", payload\.boardId\)/);
  assert.match(source, /\.eq\("owner_participant_hash", ownership\.participantOwnerHash\)/);
  assert.match(source, /\.eq\("ownership_version", ownership\.ownershipVersion\)/);
  assert.match(source, /\.in\("id", requestedIds\)/);
  assert.match(source, /\.not\("status_capability_hash", "is", null\)/);
  assert.match(source, /\.is\("deleted_at", null\)/);
  assert.match(source, /withNoStoreHeaders/);
  assert.doesNotMatch(source, /getEduJoinSessionSafe|isLikelyShareCode|normalizeShareCode|author_client_id/i);
  assert.doesNotMatch(source, /R2|EDU_BUCKET|publicUrl|publish|r2Prefix|r2Key|contentText|contentBase64/i);
});
