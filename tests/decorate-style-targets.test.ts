import assert from "node:assert/strict";
import test from "node:test";

import { resolveDecorateStyleTargets } from "@/lib/edu/lesson/decorateStyleTargets";

const slotMap = {
  image_primary: "main img",
  image_any: ["main img"],
  heading_primary: "main h1",
  text_any: ["main p"],
  section_any: ["main section", "main"],
};

test("CTA target resolution prefers button-like selectors", () => {
  const resolved = resolveDecorateStyleTargets({
    html: "<html><body><main><button class='primary'>Go</button></main></body></html>",
    slotMap,
    targetKinds: ["cta_emphasis"],
  });
  assert.equal(resolved.resolvedTargets[0]?.kind, "cta_emphasis");
  assert.match(resolved.resolvedTargets[0]?.selector ?? "", /button/);
});

test("headline target resolution finds h1/h2", () => {
  const resolved = resolveDecorateStyleTargets({
    html: "<html><body><main><h1>Title</h1></main></body></html>",
    slotMap,
    targetKinds: ["headline_emphasis"],
  });
  assert.equal(resolved.resolvedTargets[0]?.kind, "headline_emphasis");
  assert.match(resolved.resolvedTargets[0]?.selector ?? "", /h1|h2/);
});

test("card/section target resolution returns partial success when one kind is unresolved", () => {
  const resolved = resolveDecorateStyleTargets({
    html: "<html><body><main><section>Only section</section></main></body></html>",
    slotMap,
    targetKinds: ["card_tone", "section_tone"],
  });
  assert.ok(resolved.resolvedTargets.some((target) => target.kind === "section_tone"));
  assert.ok(resolved.resolvedTargets.some((target) => target.kind === "card_tone"));
});
