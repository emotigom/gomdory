import { getLessonIdFromNumber, type LessonId } from "@/lib/edu/lesson/lessonLock";
import { renderLessonSite } from "@/lib/edu/templates";
import { lessonInsuranceContent } from "@/lib/edu/templates/schema";

export function makeInsuranceTemplate(
  lessonId: number | LessonId,
  _userPrompt: string,
  _templateKey?: string | null,
): Record<string, string> {
  void _userPrompt;
  void _templateKey;
  const resolvedLessonId =
    typeof lessonId === "string" ? lessonId : getLessonIdFromNumber(lessonId) ?? "P1";
  const content = lessonInsuranceContent(resolvedLessonId);
  return renderLessonSite(resolvedLessonId, content);
}
