import assert from "node:assert/strict";
import test from "node:test";

import { buildSubmissionEvidence } from "@/lib/coding-studio/submissionEvidence";
import { createLessonTemplateProject } from "@/lib/coding-studio/projectSchema";
import { createInitialStudioRuntimeState } from "@/lib/coding-studio/interpreter";
import { STUDIO_LESSON_SCENES } from "@/lib/coding-studio/lessons";

test("submission evidence is deterministic and compact", () => {
  const lessonId = "sensor-branch" as const;
  const project = createLessonTemplateProject(lessonId);
  const runtime = createInitialStudioRuntimeState(STUDIO_LESSON_SCENES[lessonId]);
  const evidence = buildSubmissionEvidence({
    lessonId,
    project,
    runtimeState: runtime,
    assessment: {
      lessonId,
      completed: false,
      tone: "retry",
      keyCondition: "감지 조건",
      summary: "아직",
      retryHint: "조건을 추가",
      reflectionLine: "한 번 더",
    },
  });

  assert.equal(evidence.outcome, "attempted");
  assert.equal(evidence.structure.blockCount, project.blocks.length);
  assert.match(evidence.lessonSignal.retryReason ?? "", /조건/);
});
