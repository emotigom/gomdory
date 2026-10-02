import assert from "node:assert/strict";
import test from "node:test";

import { evaluateComposedStyleIntentMatch } from "@/lib/edu/lesson/decorateComposedIntentMatch";

test("CTA intent match requires button/accent op", () => {
  const result = evaluateComposedStyleIntentMatch({
    primaryStyleIntent: "cta_emphasis",
    plan: { version: 1, summary: "x", ops: [{ op: "set_button_style", target: { kind: "selector", selector: ".cta" }, style: { background: "#2563eb" } }] },
  });
  assert.equal(result.intentMatched, true);
  assert.ok(result.matchKinds.includes("cta_targeted"));
});

test("cute soft intent penalizes noisy compositions", () => {
  const result = evaluateComposedStyleIntentMatch({
    primaryStyleIntent: "cute_soft_style",
    plan: {
      version: 1,
      summary: "x",
      ops: [
        { op: "set_button_style", target: { kind: "selector", selector: ".cta" }, style: { background: "#f472b6" } },
        { op: "set_accent_style", target: { kind: "selector", selector: ".badge" }, style: { accentColor: "#f472b6" } },
        { op: "set_text_emphasis", target: { kind: "slot", slot: "heading_primary" }, style: { emphasisStrength: "strong" } },
      ],
    },
  });
  assert.ok(result.penalties.includes("noisy_composition"));
});
