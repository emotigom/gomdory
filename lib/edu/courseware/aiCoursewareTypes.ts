export const COURSEWARE_ARTIFACT_TYPES = [
  "bingo",
  "role-card",
  "prompt-card",
  "revision-comparison",
  "problem-card",
  "topic-card",
  "wireframe",
  "checklist",
  "data-table",
  "survey",
  "chart",
  "data-insight",
  "rule-table",
  "recommender-design",
  "ai-classification-result",
  "ai-error-log",
  "source-card",
  "banner",
  "copy-set",
  "page-plan",
  "web-page-draft",
  "published-page",
  "info-card-page",
  "qr-share-card",
  "interactive-guide",
  "feedback-card",
  "safety-check",
  "revision-log",
  "portfolio-outline",
  "presentation-slides",
  "showcase",
  "reflection-card",
] as const;

export type ArtifactType = (typeof COURSEWARE_ARTIFACT_TYPES)[number];

export type CoursewareTag =
  | "ai-literacy"
  | "prompt"
  | "data"
  | "web"
  | "safety"
  | "publish"
  | "portfolio"
  | "reflection";

export type ClassroomMode = "individual" | "pair" | "team" | "mixed";

export interface CoursewareLesson {
  id: string;
  lessonNumber: number;
  dayNumber: number;
  daySlot: 1 | 2;
  titleKo: string;
  oneLineActivityKo: string;
  toolHints: string[];
  artifact: {
    type: ArtifactType;
    labelKo: string;
    required: boolean;
  };
  classroomMode: ClassroomMode;
  estimatedMinutes: number;
  recovery: {
    summaryKo: string;
    catchUpStepsKo: string[];
    starterArtifactKo: string;
  };
  tags: CoursewareTag[];
  teacherNoteKo?: string;
  studentPromptKo?: string;
  extensionKo?: string;
}

export interface CoursewareStarterTemplate {
  templateId: string;
  titleKo: string;
  descriptionKo: string;
  originalLessonLabelKo: string;
  mapsToLessonNumbers: number[];
  status: "starter-template";
  riskNotesKo?: string;
}

export type CoursewareLearningModality =
  | "unplugged"
  | "browser-ai-lab"
  | "teachable-machine"
  | "notebook"
  | "gomdory-web-artifact"
  | "discussion"
  | "project-studio";

export type CoursewareLessonBlockType =
  | "theoryCapsule"
  | "interactiveSort"
  | "promptLab"
  | "miniQuiz"
  | "webCardBuilder"
  | "reflectionBuilder"
  | "codeConcept"
  | "teacherCheckpoint"
  | "extensionMission"
  | "unpluggedActivity"
  | "browserAiLab"
  | "teachableMachineLab"
  | "notebookLab"
  | "openSourceToolCard";

export interface CoursewareLessonBlockBase {
  id: string;
  type: CoursewareLessonBlockType;
  title: string;
  description: string;
  estimatedMinutes: number;
  studentInstruction: string;
  teacherNoteKo?: string;
}

export type CoursewareLessonBlock = CoursewareLessonBlockBase & Record<string, unknown>;
