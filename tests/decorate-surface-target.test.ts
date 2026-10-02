import assert from "node:assert/strict";
import test from "node:test";

import { resolveDecorateSurfaceTarget } from "@/lib/edu/lesson/decorateSurfaceTarget";

test("surface target prefers hero/primary section", () => {
  const target = resolveDecorateSurfaceTarget({
    sectionAny: ["main > section:nth-of-type(1)", "main > section:nth-of-type(2)"],
    headingPrimary: "main h1",
    textAny: ["main p"],
  });
  assert.equal(target.targetType, "hero_surface");
  assert.match(target.selector, /section/);
});
