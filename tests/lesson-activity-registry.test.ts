import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getLessonTemplate,
  isLessonActivityType,
  LESSON_ACTIVITY_DEFINITIONS,
  LESSON_ACTIVITY_TYPES,
  LESSON_TEMPLATES,
} from "@/lib/lesson-activities/registry";

const root = process.cwd();
const read = (...segments: string[]) =>
  fs.readFileSync(path.join(root, ...segments), "utf8");

test("lesson activity registry includes scaffolded activity types", () => {
  assert.deepEqual(LESSON_ACTIVITY_TYPES, [
    "ai_bingo",
    "ai_judgment_sort",
    "web_coding_lite",
    "python_studio_lite",
  ]);
  assert.equal(
    LESSON_ACTIVITY_DEFINITIONS.ai_bingo.studentReadyLabel,
    "AI 빙고 아레나 준비 중",
  );
  assert.equal(
    LESSON_ACTIVITY_DEFINITIONS.ai_judgment_sort.studentReadyLabel,
    "AI 판단 카드 분류 준비 중",
  );
  assert.equal(
    LESSON_ACTIVITY_DEFINITIONS.web_coding_lite.studentReadyLabel,
    "웹 코딩 실습 준비 중",
  );
  assert.equal(
    LESSON_ACTIVITY_DEFINITIONS.python_studio_lite.studentReadyLabel,
    "파이썬 실습실 준비 중",
  );
  assert.equal(isLessonActivityType("ai_bingo"), true);
  assert.equal(isLessonActivityType("simple_code_intro"), false);
});

test("lesson activity registry keeps lesson 1 and lesson 2 templates", () => {
  assert.ok(getLessonTemplate("lesson_01_ai_intro_python_first_steps"));
  assert.ok(getLessonTemplate("lesson_02_ai_judgment_if_else"));
  assert.equal(
    getLessonTemplate("lesson_01_ai_intro_python_first_steps")?.title,
    "1차시: 생활 속 AI와 파이썬 첫걸음",
  );
  assert.equal(
    getLessonTemplate("lesson_02_ai_judgment_if_else")?.title,
    "2차시: AI 판단과 if/else",
  );
  assert.deepEqual(
    LESSON_TEMPLATES.map((template) => template.id),
    [
      "lesson_01_ai_intro_python_first_steps",
      "lesson_02_ai_judgment_if_else",
      "lesson_03_vibe_app_planning",
      "lesson_04_vibe_app_prototype_share",
    ],
  );
  const lesson1 = getLessonTemplate("lesson_01_ai_intro_python_first_steps");
  assert.deepEqual(
    lesson1?.activities.map((activity) => activity.key),
    ["ai_bingo", "python_studio_lite"],
  );
  assert.deepEqual(
    lesson1?.activities.map((activity) => activity.title),
    ["1단계: AI 빙고", "2단계: 파이썬 첫걸음"],
  );
  const lesson2 = getLessonTemplate("lesson_02_ai_judgment_if_else");
  assert.deepEqual(
    lesson2?.activities.map((activity) => activity.key),
    ["ai_judgment_sort", "python_studio_lite", "web_coding_lite"],
  );
  assert.deepEqual(
    lesson2?.activities.map((activity) => activity.title),
    ["1단계: AI 판단 카드 분류", "2단계: 파이썬 if/else 실습", "선택: 웹 코딩 체험"],
  );
  assert.equal(lesson2?.activities[2]?.status, "placeholder");
});

test("lesson session helper validates templates and ensures AI Bingo runs for lesson 1", () => {
  const helper = read("lib", "lesson-activities", "sessions.ts");
  assert.match(helper, /getLessonTemplate\(lessonTemplateId\)/);
  assert.match(
    helper,
    /throw new Error\("지원하지 않는 수업 실습 템플릿입니다\."\)/,
  );
  assert.match(helper, /from\("class_sessions"\)/);
  assert.match(helper, /from\("boards"\)/);
  assert.match(helper, /active_session_id/);
  assert.match(helper, /ended_at: endedAt, status: "ended"/);
  assert.match(helper, /active_session_id: null/);
  assert.match(helper, /report,/);
  assert.match(helper, /ensureLessonActivityRun/);
  assert.match(helper, /endActivityRunsForSession/);
});

test("teacher API protects lesson session mutations from guests/viewers", () => {
  const route = read(
    "app",
    "api",
    "v1",
    "boards",
    "[boardId]",
    "lesson-session",
    "route.ts",
  );
  const helper = read("lib", "lesson-activities", "sessions.ts");
  assert.match(route, /isValidBoardId\(boardId\)/);
  assert.match(route, /invalid_lesson_template/);
  assert.match(route, /requireUserApiFn\(\)/);
  assert.match(route, /startLessonSessionForBoard/);
  assert.match(route, /endActiveLessonSessionForBoard/);
  assert.match(helper, /canEditBoard\(role\)/);
  assert.match(helper, /수업 실습을 관리할 권한이 없습니다/);
});

test("student route loads active lesson session but exposes no mutation controls", () => {
  const page = read("app", "s", "[code]", "page.tsx");
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  assert.match(page, /resolvePublicShareBoard\(code\)/);
  assert.match(page, /getActiveLessonSessionForBoard\(board\.id\)/);
  assert.match(
    page,
    /<StudentLessonWorkspace activeLesson=\{activeLessonSession\} board=\{boardProps\} \/>/,
  );
  assert.doesNotMatch(
    page,
    /startLessonSessionForBoard|endActiveLessonSessionForBoard|lesson-session/,
  );
  assert.match(panel, /선생님이 실습을 시작했어요/);
  assert.match(panel, /AiBingoActivity/);
  assert.match(panel, /PythonStudioLiteActivity/);
});

test("student activity panel stays inert without active lesson and renders placeholders when active", () => {
  const panel = read(
    "components",
    "lesson-activities",
    "StudentActivityPanel.tsx",
  );
  const placeholders = read(
    "components",
    "lesson-activities",
    "ActivityPlaceholders.tsx",
  );
  assert.match(panel, /if \(!activeLesson\) return null/);
  assert.match(panel, /activeLesson\.title/);
  assert.match(panel, /student-activity-switcher/);
  assert.match(panel, /student-selected-activity/);
  assert.match(panel, /max-w-\[1680px\]/);
  assert.match(panel, /<AiBingoActivity[\s\S]*shareCode=\{shareCode\}/);
  assert.match(
    panel,
    /<PythonStudioLiteActivity[\s\S]*shareCode=\{shareCode\}/,
  );
  assert.match(placeholders, /AI 판단 카드 분류 — 준비 중/);
  assert.match(placeholders, /웹 코딩 실습 — 준비 중/);
});

test("lesson activity progress migration was added deliberately", () => {
  const migrationFiles = fs.readdirSync(
    path.join(root, "supabase", "migrations"),
  );
  assert.equal(
    migrationFiles.some((file) => /lesson_activity_progress/i.test(file)),
    true,
  );
});
