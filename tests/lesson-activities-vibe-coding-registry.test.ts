import assert from "node:assert/strict";
import test from "node:test";
import {
  LESSON_ACTIVITY_TYPES,
  LESSON_TEMPLATES,
  getLessonTemplate,
  isLessonActivityType,
} from "@/lib/lesson-activities/registry";
import { LESSON_03_04_VIBE_CODING_CONTENT as content } from "@/lib/edu/vibe-coding/lesson-03-04-content";

test("registry includes lesson 03 and 04 templates", () => {
  const ids = LESSON_TEMPLATES.map((template) => template.id);
  assert.ok(ids.includes("lesson_03_vibe_app_planning"));
  assert.ok(ids.includes("lesson_04_vibe_app_prototype_share"));
});

test("getLessonTemplate returns lesson 03 and 04", () => {
  assert.notEqual(getLessonTemplate("lesson_03_vibe_app_planning"), null);
  assert.notEqual(getLessonTemplate("lesson_04_vibe_app_prototype_share"), null);
});

test("lesson 03/04 template titles align with SSOT content", () => {
  assert.equal(getLessonTemplate("lesson_03_vibe_app_planning")?.title, content.lessonPlans[0].title);
  assert.equal(getLessonTemplate("lesson_04_vibe_app_prototype_share")?.title, content.lessonPlans[1].title);
});

test("existing lesson 01 and 02 templates remain", () => {
  assert.notEqual(getLessonTemplate("lesson_01_ai_intro_python_first_steps"), null);
  assert.notEqual(getLessonTemplate("lesson_02_ai_judgment_if_else"), null);
});

test("existing activity types remain unchanged", () => {
  ["ai_bingo", "ai_judgment_sort", "web_coding_lite", "python_studio_lite"].forEach((type) => {
    assert.ok(LESSON_ACTIVITY_TYPES.includes(type as (typeof LESSON_ACTIVITY_TYPES)[number]));
    assert.equal(isLessonActivityType(type), true);
  });
});

test("lesson 03/04 activities are vibe placeholders without web_coding_lite runtime", () => {
  const lesson03 = getLessonTemplate("lesson_03_vibe_app_planning");
  const lesson04 = getLessonTemplate("lesson_04_vibe_app_prototype_share");
  const lesson02 = getLessonTemplate("lesson_02_ai_judgment_if_else");

  assert.notEqual(lesson03, null);
  assert.notEqual(lesson04, null);
  assert.notEqual(lesson02, null);

  assert.deepEqual(
    lesson03?.activities.map((activity) => activity.title),
    ["1단계: 앱 아이디어 정리", "2단계: AI 프롬프트 설계"],
  );
  assert.deepEqual(
    lesson04?.activities.map((activity) => activity.title),
    ["1단계: Lovable 프로토타입 제작(백업: Canva/Bolt/Replit/v0)", "2단계: 결과물/실패 기록 제출"],
  );

  lesson03?.activities.forEach((activity) => {
    assert.equal(activity.activityType, undefined);
  });
  lesson04?.activities.forEach((activity) => {
    assert.equal(activity.activityType, undefined);
  });

  assert.ok(lesson02?.activities.some((activity) => activity.activityType === "web_coding_lite"));
});
