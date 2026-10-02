export const COURSEWARE_PAGE_BLOCK_TYPES = [
  "hero",
  "text",
  "button-link",
  "image-placeholder",
  "card-grid",
  "faq",
  "checklist",
  "data-insight",
  "recommendation-table",
  "quiz-choice",
  "reflection",
  "source-list",
] as const;

export type CoursewarePageBlockType = (typeof COURSEWARE_PAGE_BLOCK_TYPES)[number];

type CoursewarePageBlockBase = { id: string; type: CoursewarePageBlockType; titleKo?: string; order: number };
export type CoursewarePageBlock =
  | (CoursewarePageBlockBase & { type: "hero"; headlineKo: string; subcopyKo: string; primaryButtonLabelKo: string; primaryButtonUrl: string })
  | (CoursewarePageBlockBase & { type: "text"; headingKo: string; bodyKo: string })
  | (CoursewarePageBlockBase & { type: "button-link"; labelKo: string; url: string; helperTextKo: string })
  | (CoursewarePageBlockBase & { type: "image-placeholder"; altKo: string; captionKo: string; imageUrl?: string })
  | (CoursewarePageBlockBase & { type: "card-grid"; cards: { titleKo: string; bodyKo: string }[] })
  | (CoursewarePageBlockBase & { type: "faq"; items: { questionKo: string; answerKo: string }[] })
  | (CoursewarePageBlockBase & { type: "checklist"; items: { labelKo: string; checked: boolean }[] })
  | (CoursewarePageBlockBase & { type: "data-insight"; insightKo: string; sourceKo: string; optionalValueKo?: string })
  | (CoursewarePageBlockBase & { type: "recommendation-table"; rows: { conditionKo: string; recommendationKo: string }[] })
  | (CoursewarePageBlockBase & { type: "quiz-choice"; questionKo: string; choices: { labelKo: string; feedbackKo: string }[] })
  | (CoursewarePageBlockBase & { type: "reflection"; aiHelpedKo: string; myDecisionKo: string; nextImproveKo: string })
  | (CoursewarePageBlockBase & { type: "source-list"; sources: { labelKo: string; url: string }[] });

export interface CoursewarePageDraft {
  pageId: string;
  lessonNumber: number;
  titleKo: string;
  descriptionKo?: string;
  templateId?: string;
  blocks: CoursewarePageBlock[];
  updatedAt: string;
  source: "local-page-draft";
  version: 1;
}

export type CoursewarePageTemplate = {
  templateId: string;
  titleKo: string;
  descriptionKo: string;
  recommendedLessonNumbers: number[];
  initialBlocks: CoursewarePageBlock[];
  safetyNotesKo: string;
};
