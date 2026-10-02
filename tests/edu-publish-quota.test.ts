import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_PUBLISH_LIMIT,
  buildPublishQuotaIdentity,
  countPublishedSuccessesForQuota,
  getKstDayRange,
} from "@/lib/edu/publish/quota";

test("buildPublishQuotaIdentity prefers authenticated user key", () => {
  const result = buildPublishQuotaIdentity({
    userId: "user-1",
    shareCode: "JT1001",
    lessonId: 2,
    authorName: "민수",
  });

  assert.equal(result.keyType, "student/day");
  assert.equal(result.quotaKey, "uid:user-1:jt1001:p2");
});

test("buildPublishQuotaIdentity falls back to shareCode+lesson+nickname", () => {
  const result = buildPublishQuotaIdentity({
    shareCode: "JT1001",
    lessonId: 2,
    authorName: "  민수  ",
  });

  assert.equal(result.quotaKey, "guest:jt1001:p2:nick:민수");
});

test("countPublishedSuccessesForQuota counts only successful commits", () => {
  const range = getKstDayRange(new Date("2026-01-01T01:00:00+09:00"));
  const quotaKey = "guest:jt1001:p2:nick:민수";
  const count = countPublishedSuccessesForQuota(
    [
      { publish_state: "PUBLISHED", publish_quota_key: quotaKey, last_published_at: `${range.day}T09:00:00+09:00` },
      { publish_state: "FAILED", publish_quota_key: quotaKey, last_published_at: `${range.day}T10:00:00+09:00` },
      { publish_state: "PUBLISHED", publish_quota_key: "other", last_published_at: `${range.day}T11:00:00+09:00` },
    ],
    quotaKey,
    range,
  );

  assert.equal(count, 1);
  assert.equal(DAILY_PUBLISH_LIMIT, 7);
});
