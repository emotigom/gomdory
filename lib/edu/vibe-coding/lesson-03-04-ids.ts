export const VIBE_CODING_LESSON_TEMPLATE_IDS = [
  "lesson_03_vibe_app_planning",
  "lesson_04_vibe_app_prototype_share",
] as const;

const vibeCodingTemplateIdSet = new Set<string>(VIBE_CODING_LESSON_TEMPLATE_IDS);

export function isVibeCodingLessonTemplateId(value: unknown): boolean {
  return typeof value === "string" && vibeCodingTemplateIdSet.has(value);
}
