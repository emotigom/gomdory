import type { CoursewarePageDraft } from "./aiCoursewarePageTypes";
import { summarizeDraftForPresentation } from "./aiCoursewarePublishReadiness";

export type CoursewareShareCardModel = { titleKo: string; lessonNumber: number; artifactLabelKo: string; teamLabelKo?: string; summaryKo: string; classroomNoticeKo: string; qrPlaceholderKo: string; copyTextKo: string };

export function buildShareCardModel(draft: CoursewarePageDraft, artifactLabelKo: string, teamLabelKo?: string): CoursewareShareCardModel {
  const summary = summarizeDraftForPresentation(draft);
  const notice = "공개 링크/영구 배포는 아직 연결되지 않았어요. 지금은 발표용 카드와 복사용 요약을 만듭니다.";
  const qr = "QR 자리 표시자: 실제 공개 QR은 안전한 배포 단계에서 연결됩니다.";
  return { titleKo: draft.titleKo, lessonNumber: draft.lessonNumber, artifactLabelKo, teamLabelKo, summaryKo: summary, classroomNoticeKo: notice, qrPlaceholderKo: qr, copyTextKo: `${draft.lessonNumber}차시 ${draft.titleKo}\n${artifactLabelKo}${teamLabelKo ? `\n팀: ${teamLabelKo}` : ""}\n${summary}\n${notice}` };
}
