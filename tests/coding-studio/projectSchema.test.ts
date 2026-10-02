import assert from "node:assert/strict";
import test from "node:test";

import { createLessonTemplateProject, parseCodingStudioProject } from "@/lib/coding-studio/projectSchema";

test("project schema parser accepts current version", () => {
  const template = createLessonTemplateProject("goal-move");
  const parsed = parseCodingStudioProject(template);
  assert.ok(parsed);
  assert.equal(parsed?.schemaVersion, 1);
});

test("project schema parser rejects unknown version", () => {
  const parsed = parseCodingStudioProject({ schemaVersion: 999, lessonId: "goal-move", blocks: [] });
  assert.equal(parsed, null);
});
