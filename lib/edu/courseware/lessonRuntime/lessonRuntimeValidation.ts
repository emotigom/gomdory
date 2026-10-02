import type { EduLessonRuntime } from "./lessonRuntimeTypes";
import { summarizeLessonVolume } from "./lessonRuntimeSummary";

export function validateLessonRuntime(runtime: EduLessonRuntime): string[] {
  const errors: string[] = [];
  const summary = summarizeLessonVolume(runtime);
  if (!summary.inRange40to50) errors.push("total minutes must be 40-50");
  if (!summary.requiredCoverage) errors.push("required block coverage missing");
  if (runtime.rawPromptPersistenceRequired) errors.push("raw prompt persistence must be false");
  if (!runtime.blocks.some((b) => b.kind === "verification_checklist" && b.privacyLevel === "privacy_notice_required")) errors.push("privacy reminder/check required");
  for (const block of runtime.blocks) {
    if (!block.supportsNoLogin) errors.push(`${block.id} requires login`);
    if (!block.aiOptional && !block.fallbackAvailable) errors.push(`${block.id} missing fallback`);
    if (block.aiOptional && !block.fallbackAvailable) errors.push(`${block.id} ai-optional block missing fallback`);
  }
  return errors;
}
