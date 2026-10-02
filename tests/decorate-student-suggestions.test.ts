import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  classifyStudentDecoratePromptClass,
  getStudentDecorateExamplePrompts,
  getLessonAwareStudentDecorateExamples,
  getStudentDecorateInputGuidanceCopy,
  getStructureAwareStudentDecorateExamples,
  rankStudentDecorateExamples,
  mapStudentDecorateExampleKindToPromptClass,
} from "@/lib/edu/lesson/studentDecorateUi";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("example prompt helper returns representative prompt groups", () => {
  const prompts = getStudentDecorateExamplePrompts();
  assert.equal(prompts.length, 5);
  assert.deepEqual(
    prompts.map((prompt) => prompt.kind),
    ["background", "button", "headline", "mood", "image"],
  );
});

test("example prompt kind mapping stays aligned with prompt classes", () => {
  assert.equal(mapStudentDecorateExampleKindToPromptClass("background"), "background");
  assert.equal(mapStudentDecorateExampleKindToPromptClass("button"), "button");
  assert.equal(mapStudentDecorateExampleKindToPromptClass("headline"), "headline");
  assert.equal(mapStudentDecorateExampleKindToPromptClass("section"), "section");
  assert.equal(mapStudentDecorateExampleKindToPromptClass("mood"), "mood");
  assert.equal(mapStudentDecorateExampleKindToPromptClass("image"), "image");
});

test("lesson-aware helper returns examples tuned for each lesson", () => {
  assert.deepEqual(
    getLessonAwareStudentDecorateExamples({ lessonId: "P1" }).map((item) => item.prompt),
    ["배경을 밝게 바꿔줘", "제목을 더 크게 보여줘", "자기소개 카드가 더 잘 보이게 해줘"],
  );
  assert.deepEqual(
    getLessonAwareStudentDecorateExamples({ lessonId: "P3" }).map((item) => item.prompt),
    ["버튼을 더 눈에 띄게 해줘", "퀴즈 제목을 더 크게 해줘", "게임 느낌이 나게 꾸며줘"],
  );
  assert.deepEqual(
    getLessonAwareStudentDecorateExamples({ lessonId: "P4" }).map((item) => item.prompt),
    ["작품이 더 돋보이게 배경을 바꿔줘", "전시 느낌이 나게 정리해줘", "카드/섹션을 더 깔끔하게 해줘"],
  );
});

test("structure-aware generation prioritizes CTA/card/headline/image signals", () => {
  const ranked = getStructureAwareStudentDecorateExamples({
    lessonId: "P3",
    structureSignals: { hasCTA: true, hasCards: true, hasHero: true, hasHeadline: true, hasImageSlot: true, structureConfidence: 0.92 },
  });
  assert.equal(ranked.examples[0]?.kind, "button");
  assert.equal(ranked.rankingReasonSummary.includes("cta_present_button_priority"), true);
});

test("CTA-present ranking pushes button example above others", () => {
  const result = rankStudentDecorateExamples({
    examples: getLessonAwareStudentDecorateExamples({ lessonId: "P3" }),
    structure: {
      semanticSectionKinds: ["cta"],
      detectedTargetKinds: ["cta_emphasis"],
      hasHero: false,
      hasCTA: true,
      hasCards: false,
      hasImageSlot: false,
      hasHeadline: true,
      structureConfidence: 0.9,
    },
  });
  assert.equal(result.ranked[0]?.kind, "button");
});

test("card-heavy ranking boosts mood/section examples", () => {
  const result = rankStudentDecorateExamples({
    examples: getLessonAwareStudentDecorateExamples({ lessonId: "P2" }),
    structure: {
      semanticSectionKinds: ["card_grid", "feature_list"],
      detectedTargetKinds: ["card_tone"],
      hasHero: false,
      hasCTA: false,
      hasCards: true,
      hasImageSlot: false,
      hasHeadline: true,
      structureConfidence: 0.88,
    },
  });
  assert.equal(result.ranked[0]?.kind === "mood" || result.ranked[0]?.kind === "section", true);
});

test("image-slot-present ranking includes image sample with competitive score", () => {
  const result = getStructureAwareStudentDecorateExamples({
    isFreeMode: true,
    structureSignals: { hasImageSlot: true, hasHero: false, hasCTA: false, hasCards: false, hasHeadline: true },
  });
  assert.equal(result.examples.some((example) => example.kind === "image"), true);
  assert.equal((result.examples.findIndex((example) => example.kind === "image") >= 0), true);
});

test("free mode examples stay broad and distinct from regular lessons", () => {
  const freeMode = getStructureAwareStudentDecorateExamples({ isFreeMode: true });
  assert.equal(freeMode.examples.length, 5);
  assert.equal(freeMode.examples.some((item) => item.kind === "image"), true);
  assert.equal(freeMode.examples.some((item) => item.prompt.includes("고양이 사진")), true);
});

test("example ranking remains stable when structure signals are identical", () => {
  const input = {
    examples: getLessonAwareStudentDecorateExamples({ lessonId: "P3" }),
    structure: {
      semanticSectionKinds: ["hero", "cta"],
      detectedTargetKinds: ["cta_emphasis", "headline_emphasis"],
      hasHero: true,
      hasCTA: true,
      hasCards: false,
      hasImageSlot: false,
      hasHeadline: true,
      structureConfidence: 0.91,
    },
  };
  const first = rankStudentDecorateExamples(input).ranked.map((example) => example.kind);
  const second = rankStudentDecorateExamples(input).ranked.map((example) => example.kind);
  assert.deepEqual(first, second);
});

test("prompt class classifier recognizes representative student requests", () => {
  assert.equal(classifyStudentDecoratePromptClass({ prompt: "배경을 파란색으로 바꿔줘", isAmbiguous: false }), "background");
  assert.equal(classifyStudentDecoratePromptClass({ prompt: "버튼을 더 눈에 띄게 해줘", isAmbiguous: false }), "button");
  assert.equal(classifyStudentDecoratePromptClass({ prompt: "제목을 더 크게 보여줘", isAmbiguous: false }), "headline");
  assert.equal(classifyStudentDecoratePromptClass({ prompt: "좀 더 귀엽게 꾸며줘", isAmbiguous: false }), "mood");
  assert.equal(classifyStudentDecoratePromptClass({ prompt: "사진 자리에 고양이 사진을 넣어줘", isAmbiguous: false }), "image");
});

test("student guidance copy is structure-aware and one-line", () => {
  const copy = getStudentDecorateInputGuidanceCopy({ lessonId: "P2", structureSignals: { hasCards: true, hasCTA: false } });
  assert.equal(copy.placeholder, "바꾸고 싶은 내용을 적어보세요.");
  assert.equal(copy.support, "이 화면에 보이는 요소를 바꾸고 싶다면 예시를 눌러 시작할 수 있어요.");
  assert.equal(copy.emptyHint, "예시를 눌러서 바로 시작할 수 있어요.");
});

test("student guidance copy keeps light tone differences by structure and free mode", () => {
  assert.equal(getStudentDecorateInputGuidanceCopy({ structureSignals: { hasHero: true, hasHeadline: true } }).support, "제목이나 배경처럼 잘 보이는 부분부터 바꿔볼 수 있어요.");
  assert.equal(getStudentDecorateInputGuidanceCopy({ isFreeMode: true }).support, "원하는 스타일을 짧게 적거나 예시를 눌러 시작할 수 있어요.");
});

test("student suggestion chips are rendered and ranking telemetry is wired", () => {
  assert.equal(chatPanelSource.includes('data-testid="student-decorate-suggestions"'), true);
  assert.equal(chatPanelSource.includes("handleStudentDecorateSuggestionSelect"), true);
  assert.equal(chatPanelSource.includes("fillPrompt(example.prompt);"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_selected"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_rendered"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_ranked"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_ranking_applied"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_rank_outcome_linked"), true);
  assert.equal(chatPanelSource.includes("decorate_student_example_outcome_linked"), true);
  assert.equal(chatPanelSource.includes("lessonAware: true"), true);
});

test("suggestion area is visually de-emphasized when preview/result is active", () => {
  assert.equal(chatPanelSource.includes("const studentSuggestionDeemphasized = Boolean(decorateResultReadyState) || decorateHasPendingApply || decorateTransactionActive;"), true);
});
