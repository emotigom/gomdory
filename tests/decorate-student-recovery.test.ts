import assert from "node:assert/strict";
import test from "node:test";

import { decideStudentCoachRecovery, evaluateDecoratePreviewQuality } from "@/lib/edu/lesson/decorateGuards";

const baseIntent = {
  primaryIntent: "emphasis" as const,
  secondaryIntents: [] as const,
  colors: [] as string[],
  tone: [] as string[],
  emphasisTargets: ["cta"],
  imageTargets: [],
  rewriteTargets: [],
  confidence: 0.9,
  isAmbiguous: false,
};

test("student recovery accepts strong openai preview", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: '<main style="color:red"><h1>A</h1><p>B</p></main>',
    changedFiles: 1,
    prompt: "배경을 더 또렷하게",
  });
  const decision = decideStudentCoachRecovery({ initialProvider: "openai", quality, hasDeterministicBudget: true, intent: baseIntent });
  assert.equal(decision.decision, "accept_openai");
});

test("student recovery enriches weak webllm preview", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "버튼을 눈에 띄게",
  });
  const decision = decideStudentCoachRecovery({ initialProvider: "webllm", quality, hasDeterministicBudget: true, intent: baseIntent });
  assert.equal(decision.decision, "enrich_webllm");
});

test("student recovery falls back deterministic when low impact and no visible intent", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>A</h1></main>",
    nextHtml: "<main><h1>A</h1></main>",
    changedFiles: 1,
    prompt: "조금 바꿔줘",
  });
  const decision = decideStudentCoachRecovery({
    initialProvider: "openai",
    quality,
    hasDeterministicBudget: true,
    intent: { ...baseIntent, emphasisTargets: [], colors: [], imageTargets: [] },
  });
  assert.equal(decision.decision, "fallback_deterministic");
});
