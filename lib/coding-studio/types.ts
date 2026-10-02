export const CODING_STUDIO_PROJECT_SCHEMA_VERSION = 1 as const;

export const LESSON_IDS = ["goal-move", "turn-pivot", "repeat-route", "sensor-branch", "strategy-tune", "next-preview"] as const;

export type LessonId = (typeof LESSON_IDS)[number];
export type StudioInteractiveLessonId = Exclude<LessonId, "next-preview">;
export type LessonStageGroup = "입문 기초" | "입문 확장" | "다음 단계";
export type LessonDifficulty = "입문" | "기초" | "적용" | "준비";

export type StudioBlockType =
  | "start"
  | "move"
  | "turn"
  | "wait"
  | "repeat"
  | "if_sensor"
  | "set_color"
  | "set_goal";

export type StudioBlockNode = {
  id: string;
  type: StudioBlockType;
  params?: Record<string, number | string | boolean>;
  children?: StudioBlockNode[];
};

export type CodingStudioProject = {
  schemaVersion: typeof CODING_STUDIO_PROJECT_SCHEMA_VERSION;
  projectId: string;
  title: string;
  lessonId: LessonId;
  blocks: StudioBlockNode[];
  metadata: {
    updatedAt: string;
    source: "template" | "student";
  };
};

export type StudioRuntimeGoal = {
  x: number;
  z: number;
  radius: number;
};

export type StudioRuntimeObstacle = {
  x: number;
  z: number;
  radius: number;
};

export type StudioRuntimeSceneTemplate = {
  id: LessonId;
  title: string;
  subtitle: string;
  stageGroup: LessonStageGroup;
  order: number;
  difficulty: LessonDifficulty;
  prerequisiteIds: LessonId[];
  goalLine: string;
  whyThisMatters: string;
  recommendedFirstStep: string;
  successCondition: string;
  retryHint: string;
  completionReflection: string;
  nextLessonPrompt: string;
  resetHint: string;
  assessmentFocus: string;
  teacherPurpose: string;
  sceneObservation: string;
  commonMistake: string;
  improvementSignal: string;
  ahaMoment: string;
  goal: StudioRuntimeGoal;
  obstacles: StudioRuntimeObstacle[];
  start: { x: number; z: number; heading: number };
  cameraPreset: "starter-tight" | "starter-diagonal";
};

export type StudioLessonDescriptor = StudioRuntimeSceneTemplate & {
  kind: "interactive" | "preview";
  previewLine?: string;
};

export type StudioRuntimeState = {
  x: number;
  z: number;
  heading: number;
  color: string;
  targetX: number;
  targetZ: number;
  stepCount: number;
  reachedGoal: boolean;
  blocked: boolean;
};

export type StudioDebugEvent = {
  action: string;
  detail: string;
};

export const CODING_STUDIO_PROGRESSION_SCHEMA_VERSION = 1 as const;

export type CodingStudioProgressionState = {
  schemaVersion: typeof CODING_STUDIO_PROGRESSION_SCHEMA_VERSION;
  currentLessonId: LessonId;
  completedLessonIds: LessonId[];
  unlockedLessonIds: LessonId[];
  updatedAt: string;
};

export type CodingStudioAssessmentResult = {
  lessonId: LessonId;
  completed: boolean;
  tone: "success" | "near-success" | "retry";
  keyCondition: string;
  summary: string;
  retryHint: string;
  reflectionLine: string;
};
