import type { CoursewarePageTemplate } from "./aiCoursewarePageTypes";

const baseHero = { id: "hero-1", type: "hero" as const, order: 0, headlineKo: "제목", subcopyKo: "소개", primaryButtonLabelKo: "시작하기", primaryButtonUrl: "https://example.com" };

export const AI_COURSEWARE_PAGE_TEMPLATES: CoursewarePageTemplate[] = [
  { templateId: "self-intro", titleKo: "자기소개", descriptionKo: "나를 소개하는 첫 페이지", recommendedLessonNumbers: [21, 22], safetyNotesKo: "개인정보 제외", initialBlocks: [baseHero, { id: "card-1", type: "card-grid", order: 1, cards: [{ titleKo: "취미", bodyKo: "코딩" }] }, { id: "reflect-1", type: "reflection", order: 2, aiHelpedKo: "", myDecisionKo: "", nextImproveKo: "" }] },
  { templateId: "interest", titleKo: "관심사 탐구", descriptionKo: "관심 주제를 조사", recommendedLessonNumbers: [22, 23], safetyNotesKo: "출처 표기", initialBlocks: [baseHero, { id: "card-2", type: "card-grid", order: 1, cards: [{ titleKo: "주제", bodyKo: "관심 내용" }] }, { id: "sources-1", type: "source-list", order: 2, sources: [{ labelKo: "참고", url: "https://example.com" }] }, { id: "reflect-2", type: "reflection", order: 3, aiHelpedKo: "", myDecisionKo: "", nextImproveKo: "" }] },
  { templateId: "quiz-mini-game", titleKo: "퀴즈/미니게임", descriptionKo: "선택형 안내", recommendedLessonNumbers: [25], safetyNotesKo: "커스텀 JS 없음", initialBlocks: [baseHero, { id: "quiz-1", type: "quiz-choice", order: 1, questionKo: "질문", choices: [{ labelKo: "선택 A", feedbackKo: "피드백" }] }, { id: "faq-1", type: "faq", order: 2, items: [{ questionKo: "Q", answerKo: "A" }] }] },
  { templateId: "showcase", titleKo: "작품 전시", descriptionKo: "작품 소개", recommendedLessonNumbers: [24], safetyNotesKo: "공개는 다음 단계", initialBlocks: [baseHero, { id: "card-3", type: "card-grid", order: 1, cards: [{ titleKo: "작품명", bodyKo: "설명" }] }, { id: "reflect-3", type: "reflection", order: 2, aiHelpedKo: "", myDecisionKo: "", nextImproveKo: "" }, { id: "btn-1", type: "button-link", order: 3, labelKo: "링크", helperTextKo: "임시 링크", url: "https://example.com" }] },
  { templateId: "free", titleKo: "자유모드", descriptionKo: "빈 페이지에서 시작", recommendedLessonNumbers: [21, 22, 23, 24, 25], safetyNotesKo: "안전한 블록만 사용", initialBlocks: [baseHero] },
];
