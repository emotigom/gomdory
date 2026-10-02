import test from "node:test";
import assert from "node:assert/strict";

import { getVibeCodingStudentMission } from "@/lib/edu/vibe-coding/lesson-03-04-student-mission";

test("getVibeCodingStudentMission returns lesson 03 mission", () => {
  const mission = getVibeCodingStudentMission("lesson_03_vibe_app_planning");
  assert.ok(mission);
  assert.equal(mission.title, "오늘의 미션: Gemini로 앱 기획하기");
  assert.equal(mission.recommendedTemplates.includes("앱 아이디어"), true);
  assert.equal(mission.recommendedTemplates.includes("AI 프롬프트"), true);
});

test("getVibeCodingStudentMission returns lesson 04 mission", () => {
  const mission = getVibeCodingStudentMission("lesson_04_vibe_app_prototype_share");
  assert.ok(mission);
  assert.equal(mission.title, "오늘의 미션: Lovable 프로토타입 제작");
  assert.equal(mission.recommendedTemplates.includes("작품 링크"), true);
  assert.equal(mission.recommendedTemplates.includes("친구 피드백"), true);
});

test("getVibeCodingStudentMission returns null for unrelated values", () => {
  assert.equal(getVibeCodingStudentMission("lesson_99_other"), null);
  assert.equal(getVibeCodingStudentMission(null), null);
  assert.equal(getVibeCodingStudentMission({}), null);
});

test("both missions include safety line terms", () => {
  const safetyTerms = ["실명", "전화번호", "주소", "학교명", "얼굴 사진"];
  const lesson03 = getVibeCodingStudentMission("lesson_03_vibe_app_planning");
  const lesson04 = getVibeCodingStudentMission("lesson_04_vibe_app_prototype_share");
  assert.ok(lesson03);
  assert.ok(lesson04);
  for (const term of safetyTerms) {
    assert.match(lesson03.safetyLine, new RegExp(term));
    assert.match(lesson04.safetyLine, new RegExp(term));
  }
});
