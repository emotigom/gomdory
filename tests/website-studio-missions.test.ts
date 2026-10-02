import assert from "node:assert/strict";
import test from "node:test";
import { WEBSITE_STUDIO_MISSIONS, areWebsiteStudioMissionBlockKindsValid } from "@/lib/website-studio/websiteStudioMissions";

test("mission sets exist and IDs are unique", () => {
  const keys = ["self-intro-ko", "interest-research-ko", "quiz-minigame-ko", "portfolio-exhibit-ko"];
  for (const key of keys) assert.ok(WEBSITE_STUDIO_MISSIONS[key]?.length);
  const ids = Object.values(WEBSITE_STUDIO_MISSIONS).flat().map((m) => m.missionId);
  assert.equal(new Set(ids).size, ids.length);
});

test("required block kinds are valid", () => {
  assert.equal(areWebsiteStudioMissionBlockKindsValid(Object.values(WEBSITE_STUDIO_MISSIONS).flat()), true);
});
