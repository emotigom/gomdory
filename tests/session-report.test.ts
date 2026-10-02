import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionReport,
  normalizeEventPayload,
  shouldThrottleSnapshot,
  type ClassSessionEvent,
  type ClassSessionRow,
} from "@/lib/data/sessionsReport";

test("normalizeEventPayload strips disallowed keys and PII", () => {
  const payload = {
    stepId: "abc",
    label: "Step 1",
    index: 1,
    fingerprint: "abc",
    ip: "127.0.0.1",
  };

  const normalized = normalizeEventPayload("step_changed", payload);
  assert.deepEqual(normalized, { stepId: "abc", label: "Step 1", index: 1 });
});

test("shouldThrottleSnapshot respects window", () => {
  const now = Date.now();
  assert.equal(shouldThrottleSnapshot(null, now), false);
  assert.equal(shouldThrottleSnapshot(now - 1000, now), true);
  assert.equal(shouldThrottleSnapshot(now - 30000, now), false);
});

test("buildSessionReport produces highlights", async () => {
  const session: ClassSessionRow = {
    id: "s1",
    board_id: "b1",
    share_code: "code",
    title: "테스트",
    started_at: new Date(Date.now() - 600000).toISOString(),
    ended_at: new Date().toISOString(),
    created_by: "u1",
    report: null,
    status: "ended",
  };

  const events: ClassSessionEvent[] = [
    {
      id: "e1",
      session_id: "s1",
      board_id: "b1",
      share_code: "code",
      ts: new Date().toISOString(),
      type: "snapshot",
      payload: { presenceCount: 10, pulseCount: 2 },
    },
    {
      id: "e2",
      session_id: "s1",
      board_id: "b1",
      share_code: "code",
      ts: new Date().toISOString(),
      type: "question_pinned",
      payload: { questionId: "q1" },
    },
    {
      id: "e3",
      session_id: "s1",
      board_id: "b1",
      share_code: "code",
      ts: new Date().toISOString(),
      type: "poll_opened",
      payload: { pollId: "p1", title: "선호도" },
    },
  ];

  const report = await buildSessionReport(session, events, {
    questionsTotal: 1,
    pollSummaries: [
      {
        pollId: "p1",
        title: "선호도",
        topOption: null,
        total: 10,
      },
    ],
  });
  assert.equal(report.presence?.peak, 10);
  assert.equal((report.questions as any)?.total, 1);
  assert.ok(Array.isArray(report.highlights));
  assert.ok((report.highlights as string[]).length > 0);
});
