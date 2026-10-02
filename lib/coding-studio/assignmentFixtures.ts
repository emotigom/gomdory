import { CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION, type CodingStudioAssignment } from "./assignmentSchema";

const EPOCH = new Date(0).toISOString();

export const CODING_STUDIO_ASSIGNMENT_FIXTURES: Record<string, CodingStudioAssignment> = {

  "intro-core-3": {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: "intro-core-3",
    title: "오늘의 실습 경로 · 입문 1~3",
    subtitle: "목표-회전-반복의 핵심 구조를 빠르게 정리해요.",
    lessonIds: ["goal-move", "turn-pivot", "repeat-route"],
    recommendedStartLessonId: "goal-move",
    stageGroup: "입문 기초",
    visibility: "visible",
    classroom: "데모 클래스",
    source: "mock",
    teacherPrompt: "회전과 반복을 분리해 설명하도록 유도해 주세요.",
    note: "분기 레슨 전 구조 안정화가 목표입니다.",
    dueAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  },
  "sensor-focus": {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: "sensor-focus",
    title: "조건 분기 집중 실습",
    subtitle: "입문 4~5를 중심으로 분기와 수정 근거를 점검해요.",
    lessonIds: ["sensor-branch", "strategy-tune"],
    recommendedStartLessonId: "sensor-branch",
    stageGroup: "입문 확장",
    visibility: "visible",
    classroom: "데모 클래스",
    source: "mock",
    teacherPrompt: "if_sensor 안 동작과 재시도 요약 문장을 먼저 확인해 주세요.",
    note: "필요 시 repeat-route로 짧게 복습합니다.",
    dueAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  },
  "intro-core-5": {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: "intro-core-5",
    title: "오늘의 실습 경로 · 입문 1~5",
    subtitle: "이동·회전·반복·분기·수정까지 한 흐름으로 연결해요.",
    lessonIds: ["goal-move", "turn-pivot", "repeat-route", "sensor-branch", "strategy-tune"],
    recommendedStartLessonId: "goal-move",
    stageGroup: "입문 집중 코스",
    visibility: "visible",
    classroom: "데모 클래스",
    source: "mock",
    teacherPrompt: "매 시도마다 한 가지 근거(거리/각도/분기)를 말하고 수정하게 해 주세요.",
    note: "완료보다 수정 근거의 선명함을 우선으로 봅니다.",
    dueAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  },
  "sensor-strategy-focus": {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: "sensor-strategy-focus",
    title: "분기·전략 조합 집중 실습",
    subtitle: "입문 4~5에서 감지 분기와 재시도 품질을 깊게 다져요.",
    lessonIds: ["sensor-branch", "strategy-tune"],
    recommendedStartLessonId: "sensor-branch",
    stageGroup: "입문 확장",
    visibility: "visible",
    classroom: "데모 클래스",
    source: "mock",
    teacherPrompt: "분기 안 동작 유무와 재제출 근거를 중심으로 짧게 피드백해 주세요.",
    note: "필요하면 repeat-route로 돌아가 구조를 먼저 정리해도 좋습니다.",
    dueAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  },
};

export function getAssignmentFixture(presetId: string | null | undefined): CodingStudioAssignment | null {
  if (!presetId) return null;
  return CODING_STUDIO_ASSIGNMENT_FIXTURES[presetId] ?? null;
}
