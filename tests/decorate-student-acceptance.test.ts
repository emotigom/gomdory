import assert from "node:assert/strict";
import test from "node:test";

import { decideAcceptedStudentResult, evaluateDecoratePreviewQuality, hardenOpenaiResponseQuality } from "@/lib/edu/lesson/decorateGuards";

const intent = {
  primaryIntent: "background" as const,
  secondaryIntents: [],
  colors: ["blue"],
  tone: [],
  emphasisTargets: [],
  imageTargets: [],
  rewriteTargets: [],
  confidence: 0.9,
  isAmbiguous: false,
};

test("OpenAI strong response accepted", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: '<main style="background:#2563eb"><h1>A</h1></main>',
    changedFiles: 1,
    prompt: "배경을 파란색으로 바꿔줘",
    plan: { version: 1, summary: "x", ops: [{ op: "set_surface_background", target: { kind: "slot", slot: "section_any" }, style: { mode: "solid", color: "#2563eb" } }] },
    styleIntent: "background_gradient",
  });
  const hardened = hardenOpenaiResponseQuality({ quality, intent });
  assert.equal(hardened.recommendedAction, "accept");

  const acceptance = decideAcceptedStudentResult({
    openaiQuality: quality.qualityScore,
    fallbackQuality: 0.4,
    openaiPatchable: false,
    openaiStrong: true,
  });
  assert.equal(acceptance.chosenSource, "openai");
});

test("OpenAI weak response is enriched or rejected", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "버튼을 더 눈에 띄게 해줘",
  });
  const hardened = hardenOpenaiResponseQuality({
    quality,
    intent: { ...intent, colors: [], emphasisTargets: ["button"], primaryIntent: "emphasis" },
  });
  assert.ok(hardened.recommendedAction === "enrich" || hardened.recommendedAction === "fallback");

  const acceptance = decideAcceptedStudentResult({
    openaiQuality: quality.qualityScore,
    fallbackQuality: 0.7,
    openaiPatchable: false,
    openaiStrong: false,
  });
  assert.equal(acceptance.chosenSource, "fallback_deterministic");
});
