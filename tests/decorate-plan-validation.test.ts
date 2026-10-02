import assert from "node:assert/strict";
import test from "node:test";

import { validateDecoratePlan } from "@/lib/edu/lesson/decoratePlanValidation";

test("schema valid but semantically weak -> enrich/fallback", () => {
  const result = validateDecoratePlan({
    source: "server_llm",
    intent: {
      primaryIntent: "image_replace",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: [],
      imageTargets: ["사진"],
      rewriteTargets: [],
      confidence: 0.8,
      isAmbiguous: false,
    },
    plan: { version: 1, summary: "ok", ops: [{ op: "tidy_spacing", target: { kind: "slot", slot: "section_any" }, level: "sm" }] },
  });
  assert.equal(result.isSchemaValid, true);
  assert.equal(result.isSemanticallyUseful, false);
  assert.equal(result.repairable, true);
  assert.equal(result.recommendedAction, "accept_and_enrich");
});

test("invalid schema -> reject", () => {
  const result = validateDecoratePlan({ source: "server_llm", plan: { version: 2, summary: "bad", ops: [] } });
  assert.equal(result.isSchemaValid, false);
  assert.equal(result.recommendedAction, "reject");
});
