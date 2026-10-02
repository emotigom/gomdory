import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";

export type CoursewarePortfolioArtifactRef = {
  refId: string;
  lessonNumber: number;
  artifactType: ArtifactType;
  artifactLabelKo: string;
  titleKo?: string;
  summaryKo?: string;
  source: "artifact-draft" | "page-draft" | "manual";
};

export type CoursewarePortfolioPublishedLinkRef = {
  refId: string;
  publicUrl: string;
  shareId?: string;
  titleKo?: string;
  lessonNumber?: number;
  noteKo?: string;
};

export type CoursewarePortfolioSafetySummary = {
  checkedCount: number;
  hasPrivacyCheck: boolean;
  hasAiDisclosure: boolean;
  hasSourceCheck: boolean;
  warningsKo: string[];
};

export type CoursewareFinalReflection = {
  aiHelpedKo: string;
  myDecisionKo: string;
  hardestPartKo?: string;
  proudPartKo?: string;
  nextImproveKo: string;
  studentConfirmed: boolean;
};

export type CoursewarePortfolio = {
  portfolioId: string;
  titleKo: string;
  ownerDisplayKo?: string;
  selectedArtifactRefs: CoursewarePortfolioArtifactRef[];
  selectedPublishedLinks: CoursewarePortfolioPublishedLinkRef[];
  selectedRevisionEvidenceIds: string[];
  safetySummary?: CoursewarePortfolioSafetySummary;
  finalReflection: CoursewareFinalReflection;
  showcaseSummaryKo?: string;
  updatedAt: string;
  source: "local-portfolio";
  version: 1;
};
