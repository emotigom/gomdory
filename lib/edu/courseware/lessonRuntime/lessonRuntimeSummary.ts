import type { EduLessonRuntime, EduLessonVolumeScore } from "./lessonRuntimeTypes";

export function summarizeLessonVolume(runtime: EduLessonRuntime): EduLessonVolumeScore {
  const totalEstimatedMinutes = runtime.blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
  const kinds = new Set(runtime.blocks.map((b) => b.kind));
  const requiredCoverage = kinds.has("warmup") && kinds.has("concept_card") && kinds.has("prompt_lab") && kinds.has("code_lab") && kinds.has("verification_checklist") && (kinds.has("reflection") || kinds.has("exit_ticket"));
  return { totalEstimatedMinutes, inRange40to50: totalEstimatedMinutes >= 40 && totalEstimatedMinutes <= 50, requiredCoverage };
}
