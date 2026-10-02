import type { CoursewareStarterTemplate } from "./aiCoursewareTypes";

export const AI_COURSEWARE_STARTER_TEMPLATES: CoursewareStarterTemplate[] = [
  {
    templateId: "starter-self-intro",
    titleKo: "자기소개",
    descriptionKo: "AI 도움으로 소개문을 다듬고 첫 페이지를 빠르게 완성하는 시작 템플릿",
    originalLessonLabelKo: "AI Website Studio 1교시",
    mapsToLessonNumbers: [19, 21, 22],
    status: "starter-template",
  },
  {
    templateId: "starter-interest-explore",
    titleKo: "관심사 탐구",
    descriptionKo: "학교 문제/관심 주제를 사이트 주제로 연결하는 탐구 템플릿",
    originalLessonLabelKo: "AI Website Studio 2교시",
    mapsToLessonNumbers: [5, 6, 20],
    status: "starter-template",
  },
  {
    templateId: "starter-quiz-minigame",
    titleKo: "퀴즈/미니게임",
    descriptionKo: "조건 규칙과 추천 흐름을 넣어 상호작용 페이지를 만드는 템플릿",
    originalLessonLabelKo: "AI Website Studio 3교시",
    mapsToLessonNumbers: [13, 14, 25],
    status: "starter-template",
  },
  {
    templateId: "starter-showcase",
    titleKo: "작품 전시",
    descriptionKo: "결과물을 정리하고 발표 흐름으로 확장하는 템플릿",
    originalLessonLabelKo: "AI Website Studio 4교시",
    mapsToLessonNumbers: [29, 30, 31],
    status: "starter-template",
  },
  {
    templateId: "starter-free-mode",
    titleKo: "자유모드 / 빈 페이지",
    descriptionKo: "고급·심화용 빈 캔버스. 정규 32차시 기본 경로는 아님",
    originalLessonLabelKo: "AI Website Studio 자유모드",
    mapsToLessonNumbers: [],
    status: "starter-template",
    riskNotesKo: "기본 수업 경로가 아니라 선택형 심화 모드로만 안내",
  },
];
