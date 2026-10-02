import assert from "node:assert/strict";
import test from "node:test";

import {
  createDecorateMetrics,
  endStage,
  hasDisallowedImageSource,
  incMetric,
  requestLooksLikePhotoEdit,
  resolvePhotoSlotCandidates,
  startStage,
} from "@/lib/edu/lesson/decoratePipeline";

test("decorate metrics records stage duration + counters", () => {
  const ctx = createDecorateMetrics({ requestId: "req-1", now: 100 });
  startStage(ctx, "slot_resolve", 120);
  endStage(ctx, "slot_resolve", 170);
  incMetric(ctx, "parseFailCount");
  incMetric(ctx, "retryCount", 2);

  assert.equal(ctx.stageDurations.slot_resolve, 50);
  assert.equal(ctx.parseFailCount, 1);
  assert.equal(ctx.retryCount, 2);
});

test("slot resolver discovers photo-ish candidates", () => {
  const html = '<div id="photo-card"></div><section data-slot="image-hero"></section>';
  const candidates = resolvePhotoSlotCandidates(html);
  assert.ok(candidates.length >= 1);
  assert.equal(requestLooksLikePhotoEdit("img tag 한 줄"), true);
});

test("policy guard detects external img src", () => {
  assert.equal(hasDisallowedImageSource('<img src="https://example.com/a.png" alt="x" />'), true);
  assert.equal(hasDisallowedImageSource('<img src="/local.png" alt="x" />'), false);
});
