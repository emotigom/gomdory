import assert from "node:assert/strict";
import test from "node:test";

import { suggestClipRange } from "@/lib/replay/clipSuggest";

const now = 5 * 60 * 1000;

test("suggestClipRange uses highlight defaults", () => {
  const suggestion = suggestClipRange({ kind: "highlight", ts: now });
  assert.equal(suggestion.startMs, now - 30_000);
  assert.equal(suggestion.endMs, now + 90_000);
});

test("suggestClipRange adjusts for highlight subtype", () => {
  const suggestion = suggestClipRange({ kind: "highlight", ts: now, subtype: "poll_open" });
  assert.equal(suggestion.startMs, now - 20_000);
  assert.equal(suggestion.endMs, now + 150_000);
});

test("suggestClipRange uses bookmark offsets", () => {
  const suggestion = suggestClipRange({ kind: "bookmark", ts: now });
  assert.equal(suggestion.startMs, now - 60_000);
  assert.equal(suggestion.endMs, now + 120_000);
});

test("suggestClipRange uses step window", () => {
  const nextTs = now + 5 * 60 * 1000;
  const suggestion = suggestClipRange({ kind: "step", ts: now, nextTs });
  assert.equal(suggestion.startMs, now);
  assert.equal(suggestion.endMs, nextTs);
});

test("suggestClipRange clamps to zero and max duration", () => {
  const suggestion = suggestClipRange({ kind: "highlight", ts: 10_000, subtype: "qa_close" });
  assert.equal(suggestion.startMs, 0);

  const longSuggestion = suggestClipRange({ kind: "step", ts: 0, nextTs: 60 * 60 * 1000 });
  assert.ok(longSuggestion.endMs - longSuggestion.startMs <= 20 * 60 * 1000);
});
