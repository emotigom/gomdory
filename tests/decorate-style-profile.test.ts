import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDecorateStyleProfile } from "@/lib/edu/lesson/decorateStyleProfile";

test("normalize vague cute prompt to soft_playful profile", () => {
  const profile = normalizeDecorateStyleProfile({ prompt: "좀 더 귀엽고 말랑하게", sourceIntent: "tone" });
  assert.equal(profile.profile, "soft_playful");
  assert.ok(profile.confidence >= 0.7);
});

test("normalize luxury prompt to luxury_minimal profile", () => {
  const profile = normalizeDecorateStyleProfile({ prompt: "더 세련되고 고급스럽게" });
  assert.equal(profile.profile, "luxury_minimal");
});
