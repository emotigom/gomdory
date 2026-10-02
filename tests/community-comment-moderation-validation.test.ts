import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCommentModerationReason,
  parseHiddenCommentIdsCookie,
  serializeHiddenCommentIdsCookie,
} from "@/lib/community/commentModeration";
import {
  COMMUNITY_MODERATION_OTHER_DETAIL_MAX_LENGTH,
  normalizeCommunityModerationReason,
  serializeCommunityModerationReason,
} from "@/lib/community/moderationReasons";

test("normalizeCommentModerationReason validates reason enum", () => {
  assert.equal(normalizeCommentModerationReason("   "), null);
  assert.equal(normalizeCommentModerationReason("not_allowed"), null);
  assert.equal(normalizeCommentModerationReason(" spam "), "spam");
  assert.equal(normalizeCommentModerationReason({ reason: "abuse" }), "abuse");
});

test("normalizeCommunityModerationReason validates otherDetail length", () => {
  assert.equal(
    normalizeCommunityModerationReason({ reason: "other", otherDetail: "x".repeat(COMMUNITY_MODERATION_OTHER_DETAIL_MAX_LENGTH + 1) }),
    null,
  );

  const normalized = normalizeCommunityModerationReason({ reason: "other", otherDetail: "  more context  " });
  assert.deepEqual(normalized, { reason: "other", otherDetail: "more context" });
  assert.equal(serializeCommunityModerationReason(normalized!), "other:more context");
});

test("hidden comment cookie parse/serialize is stable", () => {
  const encoded = serializeHiddenCommentIdsCookie(["a", "b", "a"]);
  assert.deepEqual(parseHiddenCommentIdsCookie(encoded), ["a", "b"]);
  assert.deepEqual(parseHiddenCommentIdsCookie("{not json"), []);
});
