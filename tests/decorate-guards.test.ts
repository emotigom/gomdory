import assert from "node:assert/strict";
import test from "node:test";

import {
  autoEnrichLowImpactPreview,
  classifyPreviewApplyConsistency,
  decideDecorateRecoveryAction,
  decidePendingInvalidationReason,
  decideStudentCoachRecovery,
  evaluateDecoratePreviewQuality,
  extractDeterministicFallbackIntent,
  shouldBlockGeneratorFallbackRestore,
} from "@/lib/edu/lesson/decorateGuards";

test("preview quality marks near no-op as low impact", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "좀 더 귀엽게",
  });
  assert.equal(quality.lowImpactPreview, true);
});

test("preview consistency mismatch classification", () => {
  const result = classifyPreviewApplyConsistency({
    pendingRequestId: "r1",
    pendingPreviewHash: "a",
    pendingBaseSnapshotVersion: "v1",
    pendingBaseHtmlHash: "h1",
    beforeSnapshotVersion: "v2",
    beforeHtmlHash: "h2",
  });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("preview_apply_snapshot_mismatch"));
  assert.ok(result.reasons.includes("preview_apply_hash_mismatch"));
});

test("pending invalidation reason enum paths", () => {
  assert.equal(
    decidePendingInvalidationReason({
      beforeSnapshotVersion: "v2",
      beforeHtmlHash: "h1",
      pendingBaseSnapshotVersion: "v1",
      pendingBaseHtmlHash: "h1",
      lastOwner: "decorate",
    }),
    "pending_stale_due_to_snapshot_change",
  );
  assert.equal(
    decidePendingInvalidationReason({
      beforeSnapshotVersion: "v1",
      beforeHtmlHash: "h2",
      pendingBaseSnapshotVersion: "v1",
      pendingBaseHtmlHash: "h1",
      lastOwner: "user_edit",
    }),
    "pending_stale_due_to_user_edit",
  );
});

test("fallback intent extraction captures color/tone/emphasis/image", () => {
  const intent = extractDeterministicFallbackIntent("배경을 빨강 파스텔로, CTA 버튼 강조하고 고양이 사진", true);
  assert.ok(intent.colors.length > 0);
  assert.ok(intent.emphasis.length > 0);
  assert.equal(intent.imageIntent, true);
  assert.equal(intent.reducedCapability, true);
});

test("generator fallback restore guard blocks expected cases", () => {
  assert.equal(
    shouldBlockGeneratorFallbackRestore({
      decorateInProgress: true,
      lastOwner: "generator",
      ownerSnapshotHash: null,
      currentHtmlHash: "h1",
      restoreTargets: ["style.css"],
    }).reason,
    "decorate_in_progress",
  );
  assert.equal(
    shouldBlockGeneratorFallbackRestore({
      decorateInProgress: false,
      lastOwner: "decorate",
      ownerSnapshotHash: "h1",
      currentHtmlHash: "h2",
      restoreTargets: ["style.css"],
    }).reason,
    "html_hash_mismatch",
  );
  const allowed = shouldBlockGeneratorFallbackRestore({
    decorateInProgress: false,
    lastOwner: "generator",
    ownerSnapshotHash: null,
    currentHtmlHash: "h1",
    restoreTargets: ["style.css"],
  });
  assert.equal(allowed.blocked, false);
});


test("low-impact auto enrich applies visual boosts", () => {
  const enriched = autoEnrichLowImpactPreview({
    nextHtml: '<main><h1>Title</h1><button>Go</button><img src="x" /></main>',
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: ["color"],
      colors: ["red"],
      tone: ["cute"],
      emphasisTargets: ["cta"],
      imageTargets: ["image"],
      rewriteTargets: [],
      confidence: 0.8,
      isAmbiguous: false,
    },
  });
  assert.equal(enriched.applied, true);
  assert.match(enriched.nextHtml, /data-decorate-image-intent/);
});

test("recovery decision returns enrich for low impact emphasis", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "CTA 버튼 더 눈에 띄게",
  });
  const decision = decideDecorateRecoveryAction({
    source: "server_llm",
    quality,
    hasFallbackBudget: true,
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: ["cta"],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.9,
      isAmbiguous: false,
    },
  });
  assert.equal(decision.decision, "enrich_preview");
});


test("fallback gap patch: tone-only and vague prompts still classify intent", () => {
  const tone = extractDeterministicFallbackIntent("좀 더 귀엽고 말랑하게", true);
  assert.ok(tone.tone.length > 0);
  const vague = extractDeterministicFallbackIntent("좀 더 예쁘게", true);
  assert.equal(vague.reducedCapability, true);
});

test("fallback gap patch: weak image slot grounding still keeps image intent", () => {
  const intent = extractDeterministicFallbackIntent("사진 자리에 고양이 사진 넣어줘", true);
  assert.equal(intent.imageIntent, true);
});


test("student coach recovery decision exposes provider-aware actions", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "버튼을 더 눈에 띄게",
  });
  const decision = decideStudentCoachRecovery({
    initialProvider: "openai",
    quality,
    hasDeterministicBudget: true,
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: ["cta"],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.8,
      isAmbiguous: false,
    },
  });
  assert.equal(decision.decision, "enrich_openai");
});
