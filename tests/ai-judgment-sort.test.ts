import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  AI_JUDGMENT_SORT_CATEGORIES,
  AI_JUDGMENT_SORT_REASON_MAX_LENGTH,
  buildInitialAiJudgmentSortState,
  buildLesson2AiJudgmentSortConfig,
  calculateJudgmentSortCompletion,
  normalizeJudgmentSortReason,
  summarizeJudgmentSortForTeacher,
  validateJudgmentCardPlacement,
} from "@/lib/lesson-activities/aiJudgmentSort";

const root = process.cwd();
const read = (...segments: string[]) => fs.readFileSync(path.join(root, ...segments), "utf8");

test("AI Judgment Sort categories and lesson 2 card pool exist", () => {
  const config = buildLesson2AiJudgmentSortConfig();
  assert.deepEqual(AI_JUDGMENT_SORT_CATEGORIES.map((category) => category.id), ["ai_good", "human_needed", "collaboration"]);
  assert.equal(config.cards.length, 12);
  assert.deepEqual(config.cards.map((card) => card.title), [
    "유튜브가 내 취향에 맞는 영상을 추천한다.",
    "의사가 환자에게 수술 여부를 결정한다.",
    "공장에서 불량 제품을 자동으로 골라낸다.",
    "판사가 범죄자의 형량을 결정한다.",
    "스팸 메일을 자동으로 차단한다.",
    "심리 상담사가 힘든 마음을 털어놓은 사람과 대화한다.",
    "내비게이션이 최단 경로를 계산한다.",
    "선생님이 학생의 의견을 직접 듣고 조언한다.",
    "AI가 X-ray 사진에서 이상 부위를 표시한다.",
    "사고 현장에서 누구를 먼저 구조할지 판단한다.",
    "로봇이 커피 주문을 받는다.",
    "온라인 번역기가 영어 문장을 한국어로 번역한다.",
  ]);
  assert.deepEqual(
    Object.fromEntries(config.cards.map((card) => [card.id, card.recommendedCategory])),
    {
      youtube_recommendation: "ai_good",
      doctor_surgery_decision: "human_needed",
      factory_defect_sort: "ai_good",
      judge_sentence: "human_needed",
      spam_filter: "ai_good",
      counselor_conversation: "human_needed",
      navigation_shortest_route: "ai_good",
      teacher_student_advice: "human_needed",
      xray_anomaly: "collaboration",
      rescue_priority: "collaboration",
      robot_coffee_order: "ai_good",
      online_translation: "ai_good",
    },
  );
  assert.ok(config.cards.some((card) => card.title === "심리 상담사가 힘든 마음을 털어놓은 사람과 대화한다." && card.discussionPrompt));
  assert.ok(config.cards.some((card) => card.title === "판사가 범죄자의 형량을 결정한다." && card.discussionPrompt));
  assert.ok(config.cards.some((card) => card.title === "AI가 X-ray 사진에서 이상 부위를 표시한다." && card.discussionPrompt));
  assert.ok(config.cards.some((card) => card.title === "사고 현장에서 누구를 먼저 구조할지 판단한다." && card.discussionPrompt));
});

test("AI Judgment Sort initial state contains all cards uncategorized", () => {
  const state = buildInitialAiJudgmentSortState("run-judgment", "participant-a");
  assert.equal(state.activityType, "ai_judgment_sort");
  assert.equal(state.cards.length, 12);
  assert.equal(state.completed, false);
  assert.equal(state.submitted, false);
  assert.ok(state.cards.every((card) => card.category === null && card.reason === ""));
});

test("AI Judgment Sort validates card ids, categories, reason length, and completion", () => {
  const config = buildLesson2AiJudgmentSortConfig();
  assert.equal(validateJudgmentCardPlacement(config, "spam_filter", "ai_good"), "ai_good");
  assert.throws(() => validateJudgmentCardPlacement(config, "missing", "ai_good"), /없는 항목/);
  assert.throws(() => validateJudgmentCardPlacement(config, "spam_filter", "wrong"), /분류할 수 없는/);
  assert.equal(normalizeJudgmentSortReason(" <b>반복</b>  처리\n"), "반복 처리");
  assert.equal(AI_JUDGMENT_SORT_REASON_MAX_LENGTH, 160);

  const state = buildInitialAiJudgmentSortState("run-judgment", "participant-a");
  assert.equal(calculateJudgmentSortCompletion({ ...state, submitted: true }), false);
  const categorized = { ...state, submitted: true, cards: state.cards.map((card) => ({ ...card, category: "ai_good" as const })) };
  assert.equal(calculateJudgmentSortCompletion(categorized), true);
});

test("AI Judgment Sort teacher summary detects split discussion cards", () => {
  const config = buildLesson2AiJudgmentSortConfig();
  const base = buildInitialAiJudgmentSortState("run-judgment", "participant-a");
  const rows = ["ai_good", "human_needed", "collaboration"].map((category, index) => ({
    id: `row-${index}`,
    displayName: `학생 ${index + 1}`,
    status: "completed",
    updatedAt: `2026-05-15T00:00:0${index}.000Z`,
    state: {
      ...base,
      submitted: true,
      cards: base.cards.map((card) => card.cardId === "rescue_priority" ? { ...card, category, reason: "의견이 갈려요" } : card),
    },
  }));
  const summary = summarizeJudgmentSortForTeacher({ activityRunId: "run-judgment", config, rows });
  const rescue = summary.cards.find((card) => card.cardId === "rescue_priority");
  assert.equal(summary.participantCount, 3);
  assert.equal(summary.submittedCount, 3);
  assert.equal(rescue?.discussionRecommended, true);
  assert.equal(rescue?.responseCount, 3);
});

test("lesson 2 creates ai_judgment_sort and python_studio_lite runs without changing AI Bingo lifecycle", () => {
  const progress = read("lib", "lesson-activities", "progress.ts");
  assert.match(progress, /getLessonTemplate\(params\.lessonTemplateId\)/);
  assert.match(progress, /AI_JUDGMENT_SORT_ACTIVITY_TYPE/);
  assert.match(progress, /buildLesson2AiJudgmentSortConfig/);
  assert.match(progress, /buildLesson2PythonStudioLiteConfig/);
  assert.match(progress, /eq\("class_session_id", params\.classSessionId\)/);
  assert.match(progress, /eq\("activity_type", spec\.activityType\)/);
  assert.match(progress, /endActivityRunsForSession/);
  assert.match(progress, /AI_BINGO_ACTIVITY_TYPE/);
});

test("share activity-state API supports AI Judgment Sort with participant-hash protection", () => {
  const route = read("app", "api", "v1", "share", "[code]", "activity-state", "route.ts");
  const progress = read("lib", "lesson-activities", "progress.ts");
  assert.match(route, /activityType === "ai_judgment_sort"/);
  assert.match(route, /getOrCreateAiJudgmentSortStateForParticipant/);
  assert.match(route, /updateAiJudgmentSortState/);
  assert.match(route, /resolvePublicShareBoard\(code\)/);
  assert.match(progress, /validateJudgmentCardPlacement/);
  assert.match(progress, /reason\.length > AI_JUDGMENT_SORT_REASON_MAX_LENGTH/);
  assert.match(progress, /participant_key_hash/);
  assert.match(progress, /\.eq\("participant_key_hash", participantKeyHash\)/);
  assert.match(progress, /\.eq\("board_id", params\.boardId\)/);
});

test("student and teacher UI render Judgment Sort controls and compact summary", () => {
  const panel = read("components", "lesson-activities", "StudentActivityPanel.tsx");
  const activity = read("components", "lesson-activities", "AiJudgmentSortActivity.tsx");
  const teacher = read("components", "lesson-activities", "AiJudgmentSortTeacherSummary.tsx");
  const board = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(panel, /<AiJudgmentSortActivity shareCode=\{shareCode\}/);
  assert.match(activity, /AI 판단 카드 분류/);
  assert.match(activity, /w-full min-w-0 max-w-full overflow-x-clip/);
  assert.match(activity, /xl:grid-cols-2/);
  assert.match(activity, /sm:grid-cols-3/);
  assert.match(activity, /AI가 잘하는 일/);
  assert.match(activity, /사람의 판단이 필요한 일/);
  assert.match(activity, /AI와 사람이 함께/);
  assert.match(activity, /왜 그렇게 생각했나요\?/);
  assert.match(activity, /제출하기/);
  assert.match(activity, /aria-pressed/);
  assert.match(teacher, /participantCount/);
  assert.match(teacher, /submittedCount/);
  assert.match(teacher, /카드별 분포/);
  assert.match(teacher, /토론 추천/);
  assert.match(teacher, /학생 화면 열기/);
  assert.match(board, /AiJudgmentSortTeacherSummary/);
});
