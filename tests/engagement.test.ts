import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickPollVote, applyReaction, openQuickPoll } from "@/lib/data/engagement";

test("reactions enforce anon cooldown", () => {
  const now = Date.now();
  const first = applyReaction({} as any, "👍", "anon-1", now);
  assert.equal(first.rateLimited, false);
  const second = applyReaction(first.next, "👍", "anon-1", now + 200);
  assert.equal(second.rateLimited, true);
});

test("quick poll ignores duplicate vote", () => {
  const now = Date.now();
  const poll = openQuickPoll({}, { question: "좋아요?", options: ["네", "아니오"], durationSec: 10 }, now);
  const first = applyQuickPollVote(poll, 1, "anon-1", now + 100);
  assert.equal(first.ignored, false);
  const second = applyQuickPollVote(first.poll, 0, "anon-1", now + 200);
  assert.equal(second.ignored, true);
  assert.equal(second.poll.counts[0], 0);
  assert.equal(second.poll.counts[1], 1);
});
