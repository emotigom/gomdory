import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecorateCacheKey,
  createDecoratePreviewCache,
  getDecorateCacheTtlMs,
  hashDecoratePrompt,
  shouldCacheDecoratePreview,
} from "@/lib/edu/lesson/decoratePreviewCache";

test("preview cache hit/miss/invalidation with ttl", () => {
  let now = 1000;
  const cache = createDecoratePreviewCache(() => now);
  const key = buildDecorateCacheKey({
    prompt: "좀 더 귀엽게",
    baseSnapshotVersion: "snap-1",
    baseHtmlHash: "h1",
    intent: { primaryIntent: "tone", isAmbiguous: false },
  });
  assert.equal(cache.get(key), null);
  cache.set({
    key,
    requestId: "req-1",
    promptHash: hashDecoratePrompt("좀 더 귀엽게"),
    primaryIntent: "tone",
    confidence: 0.8,
    ambiguous: false,
    previewHtml: "<main>ok</main>",
    previewHtmlHash: "ph1",
    qualityScore: 0.7,
    lowImpactPreview: false,
    enriched: false,
    source: "server_llm",
    fallbackReason: null,
    mutationCount: 3,
    changedFiles: 1,
    baseSnapshotVersion: "snap-1",
    baseHtmlHash: "h1",
    createdAt: now,
    ttlMs: 500,
  });
  assert.equal(cache.get(key)?.requestId, "req-1");
  now += 600;
  assert.equal(cache.get(key), null);
  cache.set({
    key,
    requestId: "req-2",
    promptHash: "abc",
    primaryIntent: "tone",
    confidence: 0.8,
    ambiguous: false,
    previewHtml: "<main>ok</main>",
    previewHtmlHash: "ph2",
    qualityScore: 0.7,
    lowImpactPreview: false,
    enriched: false,
    source: "server_llm",
    fallbackReason: null,
    mutationCount: 3,
    changedFiles: 1,
    baseSnapshotVersion: "snap-1",
    baseHtmlHash: "h1",
    createdAt: now,
    ttlMs: 500,
  });
  assert.equal(cache.invalidateByBase("h1", "snapshot_changed").invalidated.length, 1);
  assert.equal(cache.get(key), null);
});

test("low-quality cache skip policy", () => {
  assert.equal(
    shouldCacheDecoratePreview({ qualityScore: 0.2, lowImpactPreview: true, enriched: false, invalidated: false, ambiguous: false, outcomeScore: 20, outcomeBucket: "failed", planRecommendedAction: "fallback", staleRisk: "low" }).ok,
    false,
  );
  assert.equal(
    shouldCacheDecoratePreview({ qualityScore: 0.7, lowImpactPreview: true, enriched: true, invalidated: false, ambiguous: true, outcomeScore: 74, outcomeBucket: "good", planRecommendedAction: "accept", staleRisk: "low" }).ok,
    true,
  );
  assert.equal(getDecorateCacheTtlMs({ ambiguous: true }) < getDecorateCacheTtlMs({ ambiguous: false }), true);
  assert.equal(getDecorateCacheTtlMs({ ambiguous: false, satisfactionProxy: "negative" }) < getDecorateCacheTtlMs({ ambiguous: false, satisfactionProxy: "positive" }), true);
});

test("intent summary reuse key is stable for normalized prompt", () => {
  const a = buildDecorateCacheKey({
    prompt: "고양이 사진 넣어줘",
    baseSnapshotVersion: "snap-1",
    baseHtmlHash: "h1",
    intent: { primaryIntent: "image_replace", isAmbiguous: false },
  });
  const b = buildDecorateCacheKey({
    prompt: "  고양이   사진   넣어줘  ",
    baseSnapshotVersion: "snap-1",
    baseHtmlHash: "h1",
    intent: { primaryIntent: "image_replace", isAmbiguous: false },
  });
  assert.equal(a, b);
});


test("cache quality gate blocks rejected plans", () => {
  const decision = shouldCacheDecoratePreview({
    qualityScore: 0.9,
    lowImpactPreview: false,
    enriched: true,
    invalidated: false,
    ambiguous: false,
    outcomeScore: 88,
    outcomeBucket: "good",
    planRecommendedAction: "reject",
    staleRisk: "low",
  });
  assert.equal(decision.ok, false);
});


test("cache policy blocks negative satisfaction proxies", () => {
  const decision = shouldCacheDecoratePreview({
    qualityScore: 0.8,
    lowImpactPreview: false,
    enriched: true,
    invalidated: false,
    ambiguous: false,
    abandonedPreview: true,
    satisfactionProxy: "negative",
  });
  assert.equal(decision.ok, false);
});
