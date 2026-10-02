import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSemanticDecorateCoherence } from "@/lib/edu/lesson/decorateSemanticCoherence";

test("semantic coherence rewards CTA intent targeting CTA section", () => {
  const coherence = evaluateSemanticDecorateCoherence({
    styleIntent: "cta_emphasis",
    semantic: {
      hasHero: false,
      hasCTA: true,
      hasCards: false,
      semanticSections: [{ kind: "cta", selector: "main .cta", confidence: 0.9, signals: ["cta"], childTargetKinds: ["cta_emphasis"] }],
    },
    plan: {
      version: 1,
      summary: "cta",
      ops: [{ op: "set_button_style", target: { kind: "selector", selector: "main .cta button" }, style: { emphasisStrength: "strong" } }],
    },
  });
  assert.ok(coherence.score > 0.7);
  assert.ok(coherence.matchedSemanticKinds.includes("cta"));
});

