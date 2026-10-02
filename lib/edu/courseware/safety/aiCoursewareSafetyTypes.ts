import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";

export type CoursewareSafetyCheckId =
  | "privacy-no-personal-info"
  | "privacy-no-face-or-location"
  | "copyright-images-ok"
  | "copyright-text-ok"
  | "source-links-added"
  | "ai-use-disclosed"
  | "ai-output-reviewed"
  | "no-dangerous-advice"
  | "no-medical-legal-financial-claim"
  | "respectful-language"
  | "teacher-review-needed";

export type CoursewareSafetyChecklistItem = {
  id: CoursewareSafetyCheckId;
  labelKo: string;
  descriptionKo: string;
  required: boolean;
  severity: "info" | "warning" | "blocking";
  lessonTags?: string[];
  artifactTypes?: ArtifactType[];
};

export type CoursewareSafetyAcknowledgement = {
  targetType: "artifact-draft" | "page-draft" | "presentation";
  targetId: string;
  lessonNumber?: number;
  checkedIds: CoursewareSafetyCheckId[];
  notesKo?: string;
  updatedAt: string;
  source: "local-safety-check";
  version: 1;
};

export type CoursewarePublishGateStatus = {
  status: "ready" | "needs-attention" | "blocked";
  blockingReasonsKo: string[];
  warningsKo: string[];
  passedRequiredCheckIds: CoursewareSafetyCheckId[];
  missingRequiredCheckIds: CoursewareSafetyCheckId[];
  hasChecklist: boolean;
};
