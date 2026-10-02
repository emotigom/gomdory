import assert from "node:assert/strict";
import test from "node:test";

import { compareDecorateCandidates } from "@/lib/edu/lesson/decorateCandidateComparison";

const intent = {
  primaryIntent: "image_replace" as const,
  secondaryIntents: [],
  colors: [],
  tone: [],
  emphasisTargets: [],
  imageTargets: ["사진"],
  rewriteTargets: [],
  confidence: 0.8,
  isAmbiguous: false,
};

test("fallback chosen when server candidate is rejected", () => {
  const compared = compareDecorateCandidates({
    intent,
    serverPlan: { version: 1, summary: "짧", ops: [] },
    fallbackPlan: {
      version: 1,
      summary: "fallback",
      ops: [{ op: "insert_media", target: { kind: "slot", slot: "image_primary" }, media: { kind: "cat_placeholder" }, style: { prominence: "high", caption: true } }],
    },
  });
  assert.equal(compared.chosenSource, "deterministic");
  assert.ok(typeof compared.targetCoverageScore === "number");
  assert.ok(typeof compared.legibilityScore === "number");
});
