import assert from "node:assert/strict";
import test from "node:test";

import { validateDecoratePlan } from "@/lib/edu/lesson/decoratePlanValidation";
import { compareDecorateCandidates } from "@/lib/edu/lesson/decorateCandidateComparison";

const colorIntent = {
  primaryIntent: "color" as const,
  secondaryIntents: [],
  colors: ["빨강", "파랑", "그라데이션"],
  tone: [],
  emphasisTargets: [],
  imageTargets: [],
  rewriteTargets: [],
  confidence: 0.9,
  isAmbiguous: false,
};

test("plan validation flags background html-only mismatch", () => {
  const result = validateDecoratePlan({
    source: "server_llm",
    intent: colorIntent,
    styleIntent: "background_gradient",
    plan: {
      version: 1,
      summary: "콜아웃만 추가",
      ops: [{ op: "add_callout_box", target: { kind: "slot", slot: "section_any" }, text: "x" }],
    },
  });
  assert.equal(result.intentMatched, false);
  assert.ok(result.issues.includes("intent_mismatch_background"));
});

test("candidate comparison prefers style candidate over html-only candidate", () => {
  const compared = compareDecorateCandidates({
    intent: colorIntent,
    styleIntent: "background_gradient",
    serverPlan: {
      version: 1,
      summary: "콜아웃",
      ops: [{ op: "add_callout_box", target: { kind: "slot", slot: "section_any" }, text: "x" }],
    },
    fallbackPlan: {
      version: 1,
      summary: "배경",
      ops: [
        {
          op: "set_surface_background",
          target: { kind: "selector", selector: "main" },
          style: { mode: "gradient", gradientFrom: "#ef4444", gradientTo: "#3b82f6", textColor: "#fff" },
        },
      ],
    },
  });
  assert.equal(compared.chosenSource, "deterministic");
  assert.ok(compared.surfaceCoverageScore > 0);
});
