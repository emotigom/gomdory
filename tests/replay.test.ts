import assert from "node:assert/strict";
import test from "node:test";

import { applyEvent, buildReplayTimeline, createInitialReplayState, stateAt, type ReplayEvent } from "@/lib/replay/sessionReplay";

function iso(ms: number) {
  return new Date(ms).toISOString();
}

test("applyEvent updates replay state basics", () => {
  const base = Date.now();
  const event: ReplayEvent = {
    ts: iso(base),
    type: "step_changed",
    payload: { label: "인트로", index: 0 },
  };

  const initial = createInitialReplayState();
  const next = applyEvent(initial, event);

  assert.equal(next.currentStep.label, "인트로");
  assert.equal(next.currentStep.index, 0);
});

test("stateAt builds expected snapshot for timeline", () => {
  const base = Date.now();
  const events: ReplayEvent[] = [
    { ts: iso(base), type: "step_changed", payload: { label: "Intro", index: 0 } },
    { ts: iso(base + 1000), type: "qa_window_changed", payload: { open: true, prompt: "질문 주세요" } },
    { ts: iso(base + 2000), type: "question_pinned", payload: { questionId: "q1" } },
    { ts: iso(base + 3000), type: "poll_opened", payload: { pollId: "p1", title: "선호" } },
    { ts: iso(base + 4000), type: "snapshot", payload: { presenceCount: 12, pulseCount: 3 } },
  ];

  const snapshot = stateAt(events, base + 3500);
  assert.equal(snapshot.qaWindow.open, true);
  assert.equal(snapshot.pinnedQuestions.count, 1);
  assert.equal(snapshot.poll.status, "open");
});

test("buildReplayTimeline creates markers for key events", () => {
  const base = Date.now();
  const events: ReplayEvent[] = [
    { ts: iso(base), type: "step_changed", payload: { label: "Intro", index: 0 } },
    { ts: iso(base + 1000), type: "qa_window_changed", payload: { open: true } },
    { ts: iso(base + 2000), type: "question_pinned", payload: { questionId: "q1" } },
    { ts: iso(base + 3000), type: "poll_opened", payload: { pollId: "p1" } },
  ];

  const timeline = buildReplayTimeline(events);
  const markerTypes = timeline.markers.map((marker) => marker.type);

  assert.ok(markerTypes.includes("step_changed"));
  assert.ok(markerTypes.includes("qa_window_changed"));
  assert.ok(markerTypes.includes("question_pinned"));
  assert.ok(markerTypes.includes("poll_opened"));
});
