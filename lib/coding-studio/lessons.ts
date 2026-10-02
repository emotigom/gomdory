import type { CodingStudioProgressionState, LessonId, StudioInteractiveLessonId, StudioLessonDescriptor, StudioRuntimeSceneTemplate } from "./types";

export const STUDIO_LESSON_PACK = {
  id: "core-intro-pack",
  version: 2,
  title: "코딩 스튜디오 집중 입문 코스",
  description: "목표 이동부터 전략 수정까지, 5개 실습으로 실행·관찰·개선을 연결하는 코스",
} as const;

export const STUDIO_LESSON_PATH: StudioLessonDescriptor[] = [
  {
    kind: "interactive",
    id: "goal-move",
    title: "입문 1 · 목표와 이동",
    subtitle: "거리 감각을 맞춰 첫 목표 지점에 정확히 도착해요.",
    stageGroup: "입문 기초",
    order: 1,
    difficulty: "입문",
    prerequisiteIds: [],
    goalLine: "에이전트를 초록 목표 원 안으로 이동시키세요.",
    recommendedFirstStep: "이동 블록 4개를 먼저 배치하고, 실행 후 마지막 좌표를 확인해 보세요.",
    successCondition: "실행 끝에서 에이전트가 목표 원 반경 안에 머물면 성공입니다.",
    retryHint: "목표를 지나치면 이동 블록 개수나 거리 값을 한 번에 하나만 조정해 보세요.",
    completionReflection: "거리 예측과 결과 확인을 연결해, 실행 전에 계획하는 습관을 만들었어요.",
    nextLessonPrompt: "다음은 회전 기준점을 잡아 방향을 의도대로 바꾸는 연습입니다.",
    resetHint: "리셋하면 시작 좌표, 방향, 실행 상태가 레슨 기본값으로 돌아옵니다.",
    assessmentFocus: "목표 지점 도달 정확도",
    whyThisMatters: "코딩의 첫 품질은 ‘정확히 도달하는 이동’입니다. 거리 감각이 이후 모든 전략의 기준이 됩니다.",
    teacherPurpose: "학생이 감으로 움직이지 않고, 거리 예측-실행-검증 루프를 처음 형성하도록 돕습니다.",
    sceneObservation: "실행 후 마지막 좌표와 목표 원 중심의 상대 거리를 눈으로 비교해 보세요.",
    commonMistake: "이동 블록을 한 번에 크게 늘려 지나치거나, 실패 이유를 확인하지 않고 반복 실행합니다.",
    improvementSignal: "시도 횟수 대비 목표 근접도가 빠르게 안정되고, 조정 폭이 작아집니다.",
    ahaMoment: "블록을 하나 줄이거나 거리 값을 0.2만 바꿔도 결과가 달라진다는 점을 체감합니다.",
    goal: { x: 4, z: 0, radius: 0.9 },
    obstacles: [],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-tight",
  },
  {
    kind: "interactive",
    id: "turn-pivot",
    title: "입문 2 · 방향과 회전",
    subtitle: "회전 각도를 기준점으로 삼아 꺾인 길의 첫 전환을 통과해요.",
    stageGroup: "입문 기초",
    order: 2,
    difficulty: "기초",
    prerequisiteIds: ["goal-move"],
    goalLine: "회전과 이동을 조합해 ㄱ자 경로 끝 목표에 도달하세요.",
    recommendedFirstStep: "이동 2회 후 회전 45°를 넣고, 그다음 이동 2회로 시작해 보세요.",
    successCondition: "경로를 벗어나지 않고 꺾인 구간을 지나 목표 원 안에 도착하면 성공입니다.",
    retryHint: "꺾인 지점에서 벗어나면 회전 각도부터 점검한 뒤 이동 횟수를 조정하세요.",
    completionReflection: "‘언제 회전할지’ 결정하면서 순서가 결과를 바꾼다는 점을 익혔어요.",
    nextLessonPrompt: "다음은 같은 꺾임 패턴을 반복 블록으로 간결하게 구성해 봅니다.",
    resetHint: "리셋하면 회전 기준점 실험을 처음 상태에서 다시 시도할 수 있습니다.",
    assessmentFocus: "회전 시점 + 각도 정합",
    whyThisMatters: "방향 제어는 공간 코딩의 문법입니다. 회전 기준이 잡히면 복잡한 경로도 구조화할 수 있습니다.",
    teacherPurpose: "학생이 ‘이동만 늘리는 방식’에서 벗어나 방향 전환을 계획하도록 전환점을 만듭니다.",
    sceneObservation: "첫 회전 직후 진행 방향이 목표 축과 얼마나 맞는지 확인해 보세요.",
    commonMistake: "회전 각도 대신 이동 횟수만 바꿔 경로 어긋남을 해결하려고 합니다.",
    improvementSignal: "회전 뒤 궤적이 안정되고, 불필요한 보정 이동이 줄어듭니다.",
    ahaMoment: "회전 각도를 먼저 맞추면 뒤의 이동 블록이 오히려 줄어든다는 점을 발견합니다.",
    goal: { x: 2.8, z: 2.8, radius: 0.9 },
    obstacles: [{ x: 1.8, z: 0, radius: 0.6 }],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-diagonal",
  },
  {
    kind: "interactive",
    id: "repeat-route",
    title: "입문 3 · 반복으로 경로 만들기",
    subtitle: "반복 블록으로 같은 패턴을 묶어 경로를 안정적으로 완성해요.",
    stageGroup: "입문 확장",
    order: 3,
    difficulty: "기초",
    prerequisiteIds: ["turn-pivot"],
    goalLine: "반복 블록을 사용해 두 번 반복되는 경로 패턴을 완주하세요.",
    recommendedFirstStep: "반복 2회 안에 ‘이동-회전’을 넣고, 반복 밖 마무리 이동 1개를 추가해 보세요.",
    successCondition: "동일 패턴을 반복 실행해 장애물 구간을 지나 목표 원에 도착하면 성공입니다.",
    retryHint: "반복 횟수와 반복 내부 순서를 분리해서 점검하면 원인을 더 빨리 찾을 수 있어요.",
    completionReflection: "같은 동작을 묶어 코드 길이를 줄이고, 수정 지점을 명확히 만드는 법을 익혔어요.",
    nextLessonPrompt: "다음은 감지 조건으로 상황에 따라 다른 경로를 선택해 봅니다.",
    resetHint: "리셋 후 반복 내부 블록만 바꿔 비교 실험해 보세요.",
    assessmentFocus: "반복 구조로 경로 안정화",
    whyThisMatters: "반복은 ‘길이를 줄이는 도구’가 아니라 ‘수정 가능성을 높이는 구조’입니다.",
    teacherPurpose: "학생이 복사-붙여넣기식 블록 나열에서 벗어나 구조적 사고를 하도록 돕습니다.",
    sceneObservation: "첫 반복과 두 번째 반복에서 궤적이 같은지 확인하고, 어긋나는 지점을 찾으세요.",
    commonMistake: "반복 횟수를 늘려 해결하려다 오히려 경로 오차가 커집니다.",
    improvementSignal: "블록 수는 줄고 성공률은 올라가며, 수정 시도도 빠르게 수렴합니다.",
    ahaMoment: "반복 내부 1개 수정만으로 전체 경로가 정리되는 순간을 경험합니다.",
    goal: { x: 3.2, z: 3.2, radius: 0.9 },
    obstacles: [{ x: 2, z: 0.8, radius: 0.6 }],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-diagonal",
  },
  {
    kind: "interactive",
    id: "sensor-branch",
    title: "입문 4 · 감지와 조건 분기",
    subtitle: "장면 신호를 읽고 조건에 따라 회피 경로를 선택해요.",
    stageGroup: "입문 확장",
    order: 4,
    difficulty: "적용",
    prerequisiteIds: ["repeat-route"],
    goalLine: "감지 블록을 활용해 장애물을 피하고 목표까지 도달하세요.",
    recommendedFirstStep: "if_sensor 안에 회전 블록을 넣고, 분기 뒤 이동 거리를 1.2~1.4로 시도해 보세요.",
    successCondition: "감지 분기가 실제로 실행되어 충돌 없이 목표 원에 도착하면 성공입니다.",
    retryHint: "감지 블록은 배치만으로는 동작하지 않습니다. 분기 안 동작이 있는지 먼저 확인하세요.",
    completionReflection: "고정 경로가 아니라 상황 반응형 경로를 설계하는 사고를 시작했어요.",
    nextLessonPrompt: "다음은 반복·분기·이동 전략을 함께 조합해 재제출 품질까지 다듬습니다.",
    resetHint: "리셋 후 센서 분기 전후 로그를 비교하면 실패 이유를 더 쉽게 찾을 수 있어요.",
    assessmentFocus: "감지 분기 기반 회피 성공",
    whyThisMatters: "현실 문제는 항상 고정 경로로 풀리지 않습니다. 조건 분기는 코딩의 판단 근육입니다.",
    teacherPurpose: "학생이 실패를 데이터로 해석하고 조건 분기의 필요를 납득하도록 안내합니다.",
    sceneObservation: "장애물 근접 순간에 방향이 바뀌는지, 분기 이후 경로가 자연스러운지 보세요.",
    commonMistake: "감지 블록만 추가하고 분기 안 회피 동작을 넣지 않아 그대로 충돌합니다.",
    improvementSignal: "충돌 빈도가 줄고, 목표 거리 개선 폭이 안정적으로 커집니다.",
    ahaMoment: "같은 장면에서도 조건에 따라 다른 실행이 나온다는 사실을 체감합니다.",
    goal: { x: 4, z: 2.1, radius: 0.9 },
    obstacles: [
      { x: 2, z: 1, radius: 0.6 },
      { x: 3, z: 1.8, radius: 0.55 },
    ],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-diagonal",
  },
  {
    kind: "interactive",
    id: "strategy-tune",
    title: "입문 5 · 전략 조합과 수정",
    subtitle: "한 번의 성공을 넘어, 재시도 품질을 높이는 조정 전략을 연습해요.",
    stageGroup: "입문 확장",
    order: 5,
    difficulty: "적용",
    prerequisiteIds: ["sensor-branch"],
    goalLine: "반복·감지·회전을 조합해 안정적으로 목표에 도달하고 제출 품질을 개선하세요.",
    recommendedFirstStep: "첫 실행 후 목표 거리·반복/감지 사용 수를 보고, 한 항목만 조정해 재실행하세요.",
    successCondition: "목표 도달과 함께 실행 구조가 불필요하게 길지 않으면 성공입니다.",
    retryHint: "모든 값을 동시에 바꾸지 말고, 먼저 ‘회전 각도 또는 반복 횟수’ 한 가지만 조정해 보세요.",
    completionReflection: "성공 여부뿐 아니라 재시도 품질을 관리하는 학습 루프를 완성했어요.",
    nextLessonPrompt: "다음 준비 단계에서 더 복잡한 장면과 다중 조건 경로를 만나게 됩니다.",
    resetHint: "리셋 후 직전 제출 대비 달라진 점을 중심으로 다시 시도해 보세요.",
    assessmentFocus: "전략 조합 + 재시도 품질",
    whyThisMatters: "실무형 코딩은 ‘첫 성공’보다 ‘재현 가능한 성공’이 중요합니다.",
    teacherPurpose: "학생이 자기 수정 근거를 말할 수 있도록 evidence 기반 피드백 루프를 강화합니다.",
    sceneObservation: "실패/성공 시점의 로그, 목표 거리, 구조 변화(반복·감지 수)를 함께 보세요.",
    commonMistake: "성공 직후 구조를 과도하게 늘려 다음 시도에서 오히려 불안정해집니다.",
    improvementSignal: "재제출에서 목표 거리, 도달 여부, 구조 간결성이 함께 개선됩니다.",
    ahaMoment: "‘한 번 맞춘 코드’가 아니라 ‘다시 맞출 수 있는 코드’가 더 강하다는 점을 이해합니다.",
    goal: { x: 4.2, z: 2.4, radius: 0.95 },
    obstacles: [
      { x: 1.9, z: 0.9, radius: 0.55 },
      { x: 2.8, z: 1.4, radius: 0.55 },
      { x: 3.4, z: 2.2, radius: 0.5 },
    ],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-diagonal",
  },
  {
    kind: "preview",
    id: "next-preview",
    title: "다음 준비 · 조금 더 복잡한 장면 예고",
    subtitle: "다중 조건과 우선순위 전략이 필요한 다음 코스로 이어집니다.",
    stageGroup: "다음 단계",
    order: 6,
    difficulty: "준비",
    prerequisiteIds: ["strategy-tune"],
    goalLine: "다음 코스에서 적용할 전략 포인트를 미리 정리해 두세요.",
    recommendedFirstStep: "입문 1~5에서 쌓은 이동·회전·반복·분기·수정 루프를 한 줄로 요약해 보세요.",
    successCondition: "준비 단계 안내",
    retryHint: "이 단계는 미리보기입니다. 앞선 실습에서 수정 근거를 다시 확인해 주세요.",
    completionReflection: "다음 코스에 필요한 전략 언어를 스스로 설명할 준비가 되었어요.",
    nextLessonPrompt: "후속 업데이트에서 다중 조건 경로 설계 코스가 이 위치에 연결됩니다.",
    resetHint: "진행 상태를 유지한 채 이전 실습으로 돌아가 복습할 수 있어요.",
    assessmentFocus: "다음 단계 준비",
    whyThisMatters: "학습은 연결성에서 깊어집니다. 다음 코스의 질문을 미리 갖고 가면 성장이 빨라집니다.",
    teacherPurpose: "학생이 과정을 회고하고 다음 목표를 언어화하도록 마무리 관문을 제공합니다.",
    sceneObservation: "이전 레슨별로 ‘무엇을 관찰했고 무엇을 조정했는지’ 짧게 정리해 보세요.",
    commonMistake: "완료 체크만 하고, 왜 성공/실패했는지 설명 없이 넘어갑니다.",
    improvementSignal: "학생이 다음 코스 준비 문장을 스스로 만들고, 피드백 요청이 구체화됩니다.",
    ahaMoment: "실습의 핵심은 정답 도달이 아니라 설명 가능한 사고 과정이라는 점을 깨닫습니다.",
    previewLine: "준비 중인 다음 단계",
    goal: { x: 0, z: 0, radius: 0.1 },
    obstacles: [],
    start: { x: 0, z: 0, heading: 0 },
    cameraPreset: "starter-tight",
  },
];

export const STUDIO_LESSON_SCENES: Record<StudioInteractiveLessonId, StudioRuntimeSceneTemplate> = STUDIO_LESSON_PATH.filter(
  (lesson): lesson is StudioRuntimeSceneTemplate & { id: StudioInteractiveLessonId; kind: "interactive" } => lesson.kind === "interactive",
).reduce(
  (acc, lesson) => {
    acc[lesson.id] = lesson;
    return acc;
  },
  {} as Record<StudioInteractiveLessonId, StudioRuntimeSceneTemplate>,
);

export function getLessonById(lessonId: LessonId): StudioLessonDescriptor {
  const lesson = STUDIO_LESSON_PATH.find((candidate) => candidate.id === lessonId);
  if (!lesson) {
    return STUDIO_LESSON_PATH[0];
  }
  return lesson;
}

export function getNextLessonId(lessonId: LessonId): LessonId | null {
  const index = STUDIO_LESSON_PATH.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0 || index >= STUDIO_LESSON_PATH.length - 1) return null;
  return STUDIO_LESSON_PATH[index + 1].id;
}

export function canUnlockLesson(lessonId: LessonId, completedLessonIds: LessonId[]): boolean {
  const lesson = getLessonById(lessonId);
  return lesson.prerequisiteIds.every((prerequisiteId) => completedLessonIds.includes(prerequisiteId));
}

export function resolveUnlockedLessonIds(completedLessonIds: LessonId[]): LessonId[] {
  return STUDIO_LESSON_PATH.filter((lesson) => canUnlockLesson(lesson.id, completedLessonIds)).map((lesson) => lesson.id);
}

export function resolveSafeCurrentLesson(args: { currentLessonId: LessonId | null; unlockedLessonIds: LessonId[] }): LessonId {
  if (args.currentLessonId && args.unlockedLessonIds.includes(args.currentLessonId)) {
    return args.currentLessonId;
  }
  return args.unlockedLessonIds[0] ?? STUDIO_LESSON_PATH[0].id;
}

export function completeLessonProgression(args: { state: CodingStudioProgressionState; lessonId: LessonId }): CodingStudioProgressionState {
  const completedLessonIds = Array.from(new Set([...args.state.completedLessonIds, args.lessonId])) as LessonId[];
  const unlockedLessonIds = resolveUnlockedLessonIds(completedLessonIds);
  const nextLessonId = getNextLessonId(args.lessonId);
  return {
    ...args.state,
    completedLessonIds,
    unlockedLessonIds,
    currentLessonId: resolveSafeCurrentLesson({
      currentLessonId: nextLessonId ?? args.lessonId,
      unlockedLessonIds,
    }),
    updatedAt: new Date().toISOString(),
  };
}
