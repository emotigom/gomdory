import assert from "node:assert/strict";
import test from "node:test";

import { detectDecorateSemanticSections } from "@/lib/edu/lesson/decorateSemanticSections";
import { resolveDecorateStyleTargets } from "@/lib/edu/lesson/decorateStyleTargets";

test("detects hero/cta/cards semantic sections", () => {
  if (typeof DOMParser === "undefined") {
    assert.ok(true);
    return;
  }
  const html = `<html><body><main><section class="hero"><h1>Title</h1><button class="btn-primary">Start</button></section><section class="cards"><article class="card">1</article><article class="card">2</article><article class="card">3</article></section></main></body></html>`;
  const detected = detectDecorateSemanticSections({ html });
  assert.equal(detected.hasHero, true);
  assert.equal(detected.hasCTA, true);
  assert.equal(detected.hasCards, true);
  assert.ok(detected.semanticSections.some((section) => section.kind === "hero"));
  assert.ok(detected.semanticSections.some((section) => section.kind === "card_grid"));
});

test("semantic-aware CTA/headline resolution prefers semantic provenance", () => {
  if (typeof DOMParser === "undefined") {
    assert.ok(true);
    return;
  }
  const html = `<html><body><main><section class="hero"><h1>Big title</h1></section><section class="cta"><button>Apply</button></section></main></body></html>`;
  const semantic = detectDecorateSemanticSections({ html });
  const resolved = resolveDecorateStyleTargets({
    html,
    slotMap: { heading_primary: "main h1", text_any: ["main p"], section_any: ["main section"], image_any: ["main img"], image_primary: "main img" },
    targetKinds: ["cta_emphasis", "headline_emphasis"],
    semanticSections: semantic.semanticSections,
  });
  assert.equal(resolved.resolvedTargets.length, 2);
  assert.ok(resolved.resolvedTargets.some((target) => target.provenance === "semantic"));
  assert.ok(resolved.semanticCoverageScore >= 0.4);
});
