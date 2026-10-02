import type { LessonId } from "./types";

export type CodingStudioRubricCriterion = {
  criterionId: string;
  label: string;
  studentLine: string;
  teacherLookFor: string;
  feedbackPrompt: string;
};

export type CodingStudioLessonRubric = {
  lessonId: LessonId;
  learningGoal: string;
  criteria: CodingStudioRubricCriterion[];
};

export const CODING_STUDIO_RUBRIC_SCHEMA: Record<LessonId, CodingStudioLessonRubric> = {
  "goal-move": {
    lessonId: "goal-move",
    learningGoal: "거리 예측과 실행 결과를 연결해 정확한 도달을 만든다.",
    criteria: [
      {
        criterionId: "goal-move-distance-plan",
        label: "거리 계획 정확도",
        studentLine: "이동 수를 목표 거리와 맞춰 실행했나요?",
        teacherLookFor: "이동 블록 수/거리 수정 근거를 학생이 설명할 수 있는지 확인",
        feedbackPrompt: "마지막 좌표를 먼저 읽고, 한 단계만 조정해 보세요.",
      },
      {
        criterionId: "goal-move-result-check",
        label: "실행 후 확인 습관",
        studentLine: "실행 뒤 좌표와 목표 위치를 비교했나요?",
        teacherLookFor: "실패 원인을 ‘감’이 아닌 좌표 차이로 말하는지 확인",
        feedbackPrompt: "실패 이유를 ‘몇 칸 차이’로 말하면 다음 시도가 빨라집니다.",
      },
    ],
  },
  "turn-pivot": {
    lessonId: "turn-pivot",
    learningGoal: "회전 시점과 각도를 기준점으로 경로 전환을 제어한다.",
    criteria: [
      {
        criterionId: "turn-pivot-angle",
        label: "회전 각도 정합",
        studentLine: "회전 각도를 근거 있게 설정했나요?",
        teacherLookFor: "각도 변경 이유를 장면 관찰과 연결해 설명하는지 확인",
        feedbackPrompt: "이동보다 각도를 먼저 맞추면 경로가 안정됩니다.",
      },
      {
        criterionId: "turn-pivot-order",
        label: "블록 순서 제어",
        studentLine: "회전 타이밍을 경로 전환 지점과 맞췄나요?",
        teacherLookFor: "순서 변경 전후 결과 차이를 학생이 비교하는지 확인",
        feedbackPrompt: "회전 시점 1곳만 바꿔 전후 결과를 비교해 보세요.",
      },
    ],
  },
  "repeat-route": {
    lessonId: "repeat-route",
    learningGoal: "반복 구조로 경로를 간결하게 만들고 수정 가능성을 높인다.",
    criteria: [
      {
        criterionId: "repeat-route-structure",
        label: "반복 구조화",
        studentLine: "같은 패턴을 반복 블록으로 묶었나요?",
        teacherLookFor: "복제 블록을 반복 구조로 치환할 수 있는지 확인",
        feedbackPrompt: "반복 안/밖 역할을 나눠 보면 구조가 더 선명해집니다.",
      },
      {
        criterionId: "repeat-route-tuning",
        label: "반복 기반 조정",
        studentLine: "반복 횟수와 내부 순서를 분리해 조정했나요?",
        teacherLookFor: "학생이 조정 우선순위를 말할 수 있는지 확인",
        feedbackPrompt: "먼저 반복 횟수, 그다음 내부 순서 순으로 점검해 보세요.",
      },
    ],
  },
  "sensor-branch": {
    lessonId: "sensor-branch",
    learningGoal: "장면 신호를 읽고 조건 분기로 회피 전략을 선택한다.",
    criteria: [
      {
        criterionId: "sensor-branch-detection",
        label: "감지-행동 연결",
        studentLine: "감지 뒤에 실제 회피 동작이 연결되어 있나요?",
        teacherLookFor: "감지 블록 내부 동작 유무와 실행 로그를 함께 확인",
        feedbackPrompt: "감지 블록 내부에 회전 또는 이동 변경이 있어야 분기가 의미를 가집니다.",
      },
      {
        criterionId: "sensor-branch-scene-reading",
        label: "장면 신호 해석",
        studentLine: "어느 지점에서 장애물을 감지했는지 설명할 수 있나요?",
        teacherLookFor: "충돌 지점을 좌표/상황 언어로 설명하는지 확인",
        feedbackPrompt: "충돌 직전 로그 1줄을 근거로 분기 시점을 조정해 보세요.",
      },
    ],
  },
  "strategy-tune": {
    lessonId: "strategy-tune",
    learningGoal: "반복·분기·회전을 조합해 재현 가능한 성공 전략을 만든다.",
    criteria: [
      {
        criterionId: "strategy-tune-evidence",
        label: "근거 기반 수정",
        studentLine: "목표 거리·구조 수치로 수정 이유를 설명했나요?",
        teacherLookFor: "재제출에서 근거-수정-결과 연결이 보이는지 확인",
        feedbackPrompt: "이번 수정은 한 가지 수치에만 집중해 변화 원인을 분명히 하세요.",
      },
      {
        criterionId: "strategy-tune-stability",
        label: "전략 안정성",
        studentLine: "성공을 반복 가능한 구조로 유지했나요?",
        teacherLookFor: "불필요한 블록 증가 없이 성공을 재현하는지 확인",
        feedbackPrompt: "성공 후에도 블록을 줄여 같은 결과가 나오는지 확인해 보세요.",
      },
    ],
  },
  "next-preview": {
    lessonId: "next-preview",
    learningGoal: "다음 코스로 넘어갈 준비 언어를 스스로 정리한다.",
    criteria: [
      {
        criterionId: "next-preview-reflection",
        label: "학습 회고 정리",
        studentLine: "이번 코스에서 배운 전략을 한 줄로 정리했나요?",
        teacherLookFor: "학생이 다음 코스 질문을 명확히 말할 수 있는지 확인",
        feedbackPrompt: "‘무엇을 바꿨고 왜 나아졌는지’를 한 문장으로 써 보세요.",
      },
    ],
  },
};

export const CODING_STUDIO_RUBRIC_CRITERION_IDS = Array.from(
  new Set(
    Object.values(CODING_STUDIO_RUBRIC_SCHEMA).flatMap((rubric) =>
      rubric.criteria.map((criterion) => criterion.criterionId),
    ),
  ),
) as [string, ...string[]];

export type CodingStudioRubricCriterionId = (typeof CODING_STUDIO_RUBRIC_CRITERION_IDS)[number];

type LegacyLessonId = "loop-turn" | "sensor-avoid";

const LEGACY_LESSON_ID_MAP: Record<LegacyLessonId, LessonId> = {
  "loop-turn": "repeat-route",
  "sensor-avoid": "sensor-branch",
};

type LegacyRubricCriterion = {
  criterionId?: unknown;
  lessonId?: unknown;
};

export type CodingStudioRubricCriterionRecord = {
  rubricSchemaVersion: 1;
  criterionId: string;
  lessonIds: LessonId[];
};

export const CODING_STUDIO_RUBRIC_CRITERIA: CodingStudioRubricCriterionRecord[] = Object.values(
  CODING_STUDIO_RUBRIC_SCHEMA,
).flatMap((rubric) =>
  rubric.criteria.map((criterion) => ({
    rubricSchemaVersion: 1,
    criterionId: criterion.criterionId,
    lessonIds: [rubric.lessonId],
  })),
);

function resolveLessonId(input: unknown): LessonId | null {
  if (typeof input !== "string") return null;
  if ((input as LessonId) in CODING_STUDIO_RUBRIC_SCHEMA) return input as LessonId;
  if (input in LEGACY_LESSON_ID_MAP) return LEGACY_LESSON_ID_MAP[input as LegacyLessonId];
  return null;
}

export function parseCodingStudioRubricCriterion(input: unknown): CodingStudioRubricCriterionRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CodingStudioRubricCriterionRecord> & LegacyRubricCriterion;
  if (candidate.rubricSchemaVersion === 1 && typeof candidate.criterionId === "string" && Array.isArray(candidate.lessonIds)) {
    const lessonIds = candidate.lessonIds.map(resolveLessonId).filter((id): id is LessonId => Boolean(id));
    if (lessonIds.length > 0) {
      return { rubricSchemaVersion: 1, criterionId: candidate.criterionId, lessonIds };
    }
  }

  if (typeof candidate.criterionId === "string") {
    const lessonId = resolveLessonId(candidate.lessonId);
    if (lessonId) {
      return { rubricSchemaVersion: 1, criterionId: candidate.criterionId, lessonIds: [lessonId] };
    }
  }

  return null;
}

export function getRubricCriteriaForLesson(lessonId: LessonId | LegacyLessonId): CodingStudioRubricCriterionRecord[] {
  const resolved = resolveLessonId(lessonId);
  if (!resolved) return [];
  return CODING_STUDIO_RUBRIC_CRITERIA.filter((criterion) => criterion.lessonIds.includes(resolved));
}

export function resolveLessonRubricTargets(lessonId: LessonId | LegacyLessonId): {
  primary: CodingStudioRubricCriterionRecord | null;
  secondary: CodingStudioRubricCriterionRecord | null;
} {
  const criteria = getRubricCriteriaForLesson(lessonId);
  return {
    primary: criteria[0] ?? null,
    secondary: criteria[1] ?? null,
  };
}
