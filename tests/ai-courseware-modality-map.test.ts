import test from "node:test";
import assert from "node:assert/strict";
import { AI_COURSEWARE_LESSON_PACKS } from "../lib/edu/courseware/aiCoursewareLessonPacks";
import { AI_COURSEWARE_NOTEBOOK_LABS } from "../lib/edu/courseware/aiCoursewareNotebookLabs";

test("all 32 lesson packs include modalities", () => {
  assert.equal(AI_COURSEWARE_LESSON_PACKS.length, 32);
  for (const p of AI_COURSEWARE_LESSON_PACKS) assert.ok(p.modalities.length > 0);
});

test("phase modality guards", () => {
  for (const p of AI_COURSEWARE_LESSON_PACKS.filter((x) => x.day >= 17 && x.day <= 24)) assert.ok(p.modalities.includes("notebook"));
  for (const p of AI_COURSEWARE_LESSON_PACKS.filter((x) => x.day >= 25 && x.day <= 32)) assert.ok(p.modalities.includes("project-studio") || p.modalities.includes("gomdory-web-artifact"));
});

test("privacy notes exist for teachable machine days", () => {
  const sensitive = AI_COURSEWARE_LESSON_PACKS.filter((p) => p.modalities.includes("teachable-machine"));
  assert.ok(sensitive.length > 0);
  for (const p of sensitive) {
    assert.ok(p.safetyNotes.length > 0);
    assert.ok(p.toolPlan.some((t) => t.modality !== "teachable-machine" || !!t.privacyNote));
    assert.ok(!JSON.stringify(p).includes("server-side storage"));
  }
});

test("notebook lab metadata exists for day 17-24", () => {
  const days = new Set(AI_COURSEWARE_NOTEBOOK_LABS.map((x) => x.day));
  for (let day = 17; day <= 24; day += 1) assert.equal(days.has(day), true);
});
