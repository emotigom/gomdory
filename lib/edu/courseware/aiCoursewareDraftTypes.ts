import type { ArtifactType, CoursewareLesson } from "./aiCoursewareTypes";

export type CoursewareDraftStatus = "empty" | "draft" | "complete" | "export-ready";

export type CoursewareArtifactDraft = {
  draftId: string;
  lessonNumber: number;
  artifactType: ArtifactType;
  artifactLabelKo: string;
  titleKo: string;
  bodyKo?: string;
  linkUrl?: string;
  checklistItems?: { id: string; labelKo: string; checked: boolean }[];
  beforeTextKo?: string;
  afterTextKo?: string;
  revisionReasonKo?: string;
  reflectionKo?: string;
  isComplete?: boolean;
  updatedAt: string;
  source: "local-draft";
  version: 1;
};

export function makeEmptyDraftFromLesson(lesson: CoursewareLesson): CoursewareArtifactDraft {
  return {
    draftId: `lesson-${lesson.lessonNumber}`,
    lessonNumber: lesson.lessonNumber,
    artifactType: lesson.artifact.type,
    artifactLabelKo: lesson.artifact.labelKo,
    titleKo: `${lesson.titleKo} 결과물`,
    updatedAt: new Date().toISOString(),
    source: "local-draft",
    version: 1,
  };
}

export function getDraftStatus(draft: CoursewareArtifactDraft | null): CoursewareDraftStatus {
  if (!draft) return "empty";
  if (draft.isComplete) return "complete";
  const hasContent = [draft.bodyKo, draft.linkUrl, draft.beforeTextKo, draft.afterTextKo, draft.revisionReasonKo, draft.reflectionKo].some((v) => Boolean(v?.trim())) || (draft.checklistItems?.length ?? 0) > 0;
  return hasContent ? "draft" : "empty";
}
