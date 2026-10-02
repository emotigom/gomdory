import { AI_COURSEWARE_LESSONS } from "@/lib/edu/courseware/aiCoursewareLessons";
import { DEFAULT_PUBLISH_SCOPE, type AiLearningSpineConfig, type TeacherRubricSignal } from "./aiLearningSpineTypes";

const rubricHints: TeacherRubricSignal[] = [
  { domain: "educational_effectiveness", label: "학습 목표 정렬", focus: "결과물이 오늘 목표와 맞는지" },
  { domain: "ethics_privacy", label: "개인정보/윤리", focus: "실명·민감정보 제거 및 공정성 점검" },
  { domain: "technical_reliability", label: "기술 신뢰성", focus: "링크/기능 오류와 사실 오류 확인" },
  { domain: "accessibility_inclusion", label: "접근성", focus: "alt text·자막·모바일 가독성 확인" },
  { domain: "personalized_support", label: "개별화 지원", focus: "막힌 지점을 기록하고 다음 지원 계획 수립" },
];

export const AI_LEARNING_SPINE_CATALOG: AiLearningSpineConfig[] = AI_COURSEWARE_LESSONS.map((lesson) => ({
  lessonNumber: lesson.lessonNumber,
  dayNumber: lesson.dayNumber,
  title: lesson.titleKo,
  conceptCard: {
    headline: `${lesson.titleKo}의 AI 개념`,
    body: `오늘 활동: ${lesson.oneLineActivityKo}`,
    humanJudgementPoint: "AI 제안은 초안이고, 최종 선택·검증·책임은 사람이 한다.",
  },
  promptChips: [
    { id: `l${lesson.lessonNumber}-easy`, label: "쉽게 설명", promptTemplate: "초등 고학년 눈높이로 쉽게 설명해줘.", intent: "understand" },
    { id: `l${lesson.lessonNumber}-example`, label: "예시 추가", promptTemplate: "우리 수업 맥락 예시 2개를 넣어줘.", intent: "create" },
    { id: `l${lesson.lessonNumber}-source`, label: "출처 확인", promptTemplate: "주장의 근거와 출처 확인 질문 목록을 줘.", intent: "verify" },
    { id: `l${lesson.lessonNumber}-short`, label: "더 짧게", promptTemplate: "핵심만 3줄로 줄여줘.", intent: "improve" },
    { id: `l${lesson.lessonNumber}-tone`, label: "내 말투로", promptTemplate: "딱딱하지 않게 학생 말투로 바꿔줘.", intent: "reflect" },
  ],
  verificationItems: [
    { id: `l${lesson.lessonNumber}-fact`, label: "사실 확인", kind: "fact", required: true },
    { id: `l${lesson.lessonNumber}-source`, label: "출처 확인", kind: "source", required: true },
    { id: `l${lesson.lessonNumber}-privacy`, label: "개인정보 제거", kind: "privacy", required: true },
    { id: `l${lesson.lessonNumber}-copyright`, label: "저작권/라이선스", kind: "copyright", required: true },
    { id: `l${lesson.lessonNumber}-bias`, label: "편향/차별 표현", kind: "bias", required: true },
    { id: `l${lesson.lessonNumber}-accessibility`, label: "접근성", kind: "accessibility", required: true },
    { id: `l${lesson.lessonNumber}-publish`, label: "공개 범위 확인", kind: "publish_scope", required: true },
  ],
  evidencePrompts: {
    goalPrompt: "무엇을 만들고 싶었나요?",
    changedReasonPrompt: "무엇을 왜 고쳤나요?",
    verificationPrompt: "어떻게 확인했나요?",
    nextRevisionPrompt: "다음 수정은 무엇인가요?",
  },
  teacherRubricHints: rubricHints,
  publishScopeDefault: DEFAULT_PUBLISH_SCOPE,
}));

export const getAiLearningSpineByLesson = (lessonNumber: number) => AI_LEARNING_SPINE_CATALOG.find((item) => item.lessonNumber === lessonNumber) ?? null;
