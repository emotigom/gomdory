import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDecorateStyleIntent,
  evaluateDecorateIntentMatch,
  shouldAllowHtmlMutationForDecorateIntent,
  shouldUseSlotResolverForDecorateIntent,
} from "@/lib/edu/lesson/decorateStyleIntent";

test("gradient/background prompt classified as background_gradient", () => {
  const intent = classifyDecorateStyleIntent({
    prompt: "배경을 빨강/파랑 그라데이션으로 바꿔주세요",
    intent: {
      primaryIntent: "color",
      secondaryIntents: [],
      colors: ["빨강", "파랑", "그라데이션"],
      tone: [],
      emphasisTargets: [],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.9,
      isAmbiguous: false,
    },
  });
  assert.equal(intent.styleIntent, "background_gradient");
  assert.equal(intent.primaryStyleIntent, "background_gradient");
  assert.equal(shouldUseSlotResolverForDecorateIntent({ styleIntent: intent.styleIntent, prompt: "배경을 빨강/파랑 그라데이션으로" }), false);
  assert.equal(shouldAllowHtmlMutationForDecorateIntent({ styleIntent: intent.styleIntent, prompt: "배경을 빨강/파랑 그라데이션으로" }), false);
});

test("background intent + callout-only plan is mismatch", () => {
  const match = evaluateDecorateIntentMatch({
    styleIntent: "background_color",
    plan: {
      version: 1,
      summary: "x",
      ops: [{ op: "add_callout_box", target: { kind: "slot", slot: "section_any" }, text: "x" }],
    },
  });
  assert.equal(match.intentMatched, false);
  assert.ok(match.mismatchKinds.includes("background_intent_callout_insertion"));
});


test("vague soft prompt classified to composed style intent", () => {
  const intent = classifyDecorateStyleIntent({
    prompt: "좀 더 귀엽고 말랑하게",
    intent: {
      primaryIntent: "tone",
      secondaryIntents: [],
      colors: [],
      tone: ["귀엽"],
      emphasisTargets: [],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.7,
      isAmbiguous: false,
    },
  });
  assert.equal(intent.primaryStyleIntent, "cute_soft_style");
  assert.ok(intent.secondaryStyleIntents.includes("headline_emphasis"));
});


test("student-friendly emphasis prompts map reliably", () => {
  const button = classifyDecorateStyleIntent({
    prompt: "버튼을 더 눈에 띄게",
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: ["버튼"],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.85,
      isAmbiguous: false,
    },
  });
  assert.equal(button.primaryStyleIntent, "cta_emphasis");

  const headline = classifyDecorateStyleIntent({
    prompt: "제목을 더 크게 잘 보이게",
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: ["제목"],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.82,
      isAmbiguous: false,
    },
  });
  assert.equal(headline.primaryStyleIntent, "headline_emphasis");
});
