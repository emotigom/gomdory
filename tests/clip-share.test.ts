import assert from "node:assert/strict";
import test from "node:test";

import { normalizeExpiresInDays, validateRange } from "@/lib/data/sessionClipShares";
import { buildPublicClipResponse } from "@/lib/replay/publicClipResponse";
import { sanitizePublicPayload } from "@/lib/replay/publicSanitize";
import { isoFrom } from "@/tests/helpers/timeFixtures";

test("validateRange rejects invalid ranges", () => {
  try {
    validateRange("bad", isoFrom());
    assert.fail("expected range_parse error");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "range_parse");
  }

  try {
    const now = isoFrom();
    validateRange(now, now);
    assert.fail("expected range_invalid error");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "range_invalid");
  }

  try {
    validateRange(isoFrom(), isoFrom(20 * 60 * 1000 + 1000));
    assert.fail("expected range_too_long error");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "range_too_long");
  }
});

test("normalizeExpiresInDays rejects unexpected values", () => {
  assert.throws(() => normalizeExpiresInDays(5), /expires_invalid/);
  assert.equal(normalizeExpiresInDays(7), 7);
  assert.equal(normalizeExpiresInDays(null), null);
});

test("sanitizePublicPayload removes student text in safe mode", () => {
  const payload = sanitizePublicPayload("safe", {
    events: [
      {
        ts: isoFrom(),
        type: "question_pinned",
        payload: { questionId: "q1", title: "학생 질문", nickname: "민수" },
      },
    ],
    bookmarks: [{ id: "b1", ts: isoFrom(), note: "민감 메모" }],
  });

  const eventPayload = payload.events[0]?.payload ?? {};
  assert.equal((eventPayload as { title?: string }).title, undefined);
  assert.equal(payload.bookmarks[0]?.note, null);
});

test("public clip response meta omits internal identifiers", () => {
  const response = buildPublicClipResponse({
    share: {
      title: "Test Clip",
      mode: "safe",
      clip_start_ts: isoFrom(),
      clip_end_ts: isoFrom(60_000),
      created_at: isoFrom(),
      expires_at: null,
      revoked_at: null,
    },
    payload: { events: [], bookmarks: [] },
  });

  assert.equal("boardId" in response.meta, false);
  assert.equal("sessionId" in response.meta, false);
  assert.equal(response.meta.mode, "safe");
});
