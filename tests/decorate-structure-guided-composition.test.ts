import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateStyleComposition } from "@/lib/edu/lesson/decorateStyleComposition";

test("structure-guided composition uses hero-centered strategy", () => {
  const composed = buildDecorateStyleComposition({
    primaryStyleIntent: "headline_emphasis",
    secondaryStyleIntents: [],
    styleProfile: "clean_modern",
    colorTokens: [],
    semantic: {
      hasHero: true,
      hasCTA: true,
      hasCards: false,
      primarySectionKind: "hero",
      semanticSections: [
        { kind: "hero", selector: "main .hero", confidence: 0.9, signals: ["x"], childTargetKinds: ["headline_emphasis"] },
        { kind: "cta", selector: "main .cta", confidence: 0.8, signals: ["y"], childTargetKinds: ["cta_emphasis"] },
      ],
    },
    resolvedTargets: [{ kind: "headline_emphasis", selector: "main .hero h1", confidence: 0.9, source: "semantic", priority: 0, semanticKind: "hero", resolverReason: "semantic_headline_priority", provenance: "semantic" }],
  });
  assert.equal(composed.compositionStrategy, "hero_centered");
  assert.ok(composed.refinedReasons.some((reason) => reason.includes("structure_strategy:hero_centered")));
});
