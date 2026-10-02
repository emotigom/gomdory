import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";
import type { CoursewarePublishReadiness } from "@/lib/edu/courseware/pageBuilder/aiCoursewarePublishReadiness";
import { PRIVACY_CHECK_IDS, REQUIRED_SAFETY_CHECK_IDS } from "./aiCoursewareSafetyChecklist";
import type { CoursewarePublishGateStatus, CoursewareSafetyAcknowledgement } from "./aiCoursewareSafetyTypes";

export function evaluateCoursewarePublishGate({ readiness, checklist }: { readiness: CoursewarePublishReadiness; checklist: CoursewareSafetyAcknowledgement | null; targetType: string; lessonNumber?: number; artifactType?: ArtifactType }): CoursewarePublishGateStatus {
  const blockingReasonsKo: string[] = [];
  const warningsKo: string[] = [];
  const checked = new Set(checklist?.checkedIds ?? []);
  const missingRequiredCheckIds = REQUIRED_SAFETY_CHECK_IDS.filter((id) => !checked.has(id));
  const passedRequiredCheckIds = REQUIRED_SAFETY_CHECK_IDS.filter((id) => checked.has(id));

  if (readiness.status === "blocked") blockingReasonsKo.push("기술 안전 점검에서 차단 항목이 있어요.");
  if (!checklist) warningsKo.push("아직 점검 전이에요.");
  if (missingRequiredCheckIds.some((id) => PRIVACY_CHECK_IDS.includes(id))) {
    if (readiness.status === "blocked") blockingReasonsKo.push("개인정보 점검 항목이 비어 있어요.");
    else warningsKo.push("개인정보 점검을 먼저 확인해요.");
  }
  if (missingRequiredCheckIds.some((id) => ["source-links-added", "ai-use-disclosed", "copyright-images-ok", "copyright-text-ok", "ai-output-reviewed"].includes(id))) {
    warningsKo.push("출처/저작권/AI 활용 표시 점검이 더 필요해요.");
  }
  if (checked.has("teacher-review-needed")) warningsKo.push("선생님 확인이 필요한 내용으로 표시됐어요.");

  const status: CoursewarePublishGateStatus["status"] = blockingReasonsKo.length > 0 ? "blocked" : (warningsKo.length > 0 || missingRequiredCheckIds.length > 0 || readiness.status === "needs-attention") ? "needs-attention" : "ready";
  return { status, blockingReasonsKo, warningsKo, passedRequiredCheckIds, missingRequiredCheckIds, hasChecklist: Boolean(checklist) };
}
