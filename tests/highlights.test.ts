import assert from "node:assert/strict";
import test from "node:test";

import { buildHighlights } from "@/lib/replay/highlights";
import type { ReplayEvent } from "@/lib/replay/sessionReplay";

function iso(ms: number) {
  return new Date(ms).toISOString();
}

test("buildHighlights creates poll highlights", () => {
  const base = Date.now();
  const events: ReplayEvent[] = [
    { ts: iso(base), type: "poll_opened", payload: { pollId: "p1", title: "선호도" } },
    { ts: iso(base + 1000), type: "poll_closed", payload: { pollId: "p1" } },
  ];

  const highlights = buildHighlights(events);
  assert.ok(highlights.some((item) => item.type === "poll" && item.title === "투표 시작"));
  assert.ok(highlights.some((item) => item.type === "poll" && item.title === "투표 종료"));
});

test("buildHighlights detects pulse peak", () => {
  const base = Date.now();
  const events: ReplayEvent[] = [
    { ts: iso(base), type: "snapshot", payload: { pulseCount: 2 } },
    { ts: iso(base + 1000), type: "snapshot", payload: { pulseCount: 6 } },
    { ts: iso(base + 2000), type: "snapshot", payload: { pulseCount: 3 } },
  ];

  const highlights = buildHighlights(events);
  const pulse = highlights.find((item) => item.type === "pulse");
  assert.ok(pulse);
  assert.equal(pulse?.ts, Date.parse(iso(base + 1000)));
});

test("buildHighlights detects presence drop spikes", () => {
  const base = Date.now();
  const events: ReplayEvent[] = [
    { ts: iso(base), type: "snapshot", payload: { presenceCount: 20 } },
    { ts: iso(base + 1000), type: "snapshot", payload: { presenceCount: 18 } },
    { ts: iso(base + 2000), type: "snapshot", payload: { presenceCount: 8 } },
  ];

  const highlights = buildHighlights(events);
  assert.ok(highlights.some((item) => item.type === "presence"));
});
