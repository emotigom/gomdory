import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateStyleComposition } from "@/lib/edu/lesson/decorateStyleComposition";

test("cta emphasis builds focused button/accent style ops", () => {
  const composed = buildDecorateStyleComposition({
    primaryStyleIntent: "cta_emphasis",
    secondaryStyleIntents: [],
    styleProfile: "none",
    colorTokens: [],
    resolvedTargets: [{ kind: "cta_emphasis", selector: "main .cta", confidence: 0.9, source: "dom_query", priority: 1 }],
  });
  assert.ok(composed.opKinds.includes("set_button_style"));
  assert.ok(composed.finalOpCount <= 2);
  assert.ok(composed.refinedReasons.includes("cta_focus_core_targets_only"));
});

test("soft profile builds balanced surface/headline/accent ops", () => {
  const composed = buildDecorateStyleComposition({
    primaryStyleIntent: "cute_soft_style",
    secondaryStyleIntents: ["surface_tone", "headline_emphasis", "accent_emphasis"],
    styleProfile: "soft_playful",
    colorTokens: [],
    resolvedTargets: [
      { kind: "section_tone", selector: "main section", confidence: 0.8, source: "dom_query", priority: 1 },
      { kind: "headline_emphasis", selector: "main h1", confidence: 0.9, source: "dom_query", priority: 1 },
      { kind: "accent_emphasis", selector: ".badge", confidence: 0.9, source: "dom_query", priority: 1 },
    ],
  });
  assert.ok(composed.opKinds.includes("set_surface_tone"));
  assert.ok(composed.opKinds.includes("set_text_emphasis"));
  assert.ok(composed.opKinds.includes("set_accent_style"));
  assert.ok(composed.finalOpCount <= 4);
});
