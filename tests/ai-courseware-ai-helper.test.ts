import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { buildTemplateFallbackSuggestions } from "../lib/edu/courseware/aiHelper/aiCoursewareAiHelperFallback";
import { validateAiHelperRequest } from "../lib/edu/courseware/aiHelper/aiCoursewareAiHelperRequest";

test("validation and fallback", () => {
  assert.equal(validateAiHelperRequest({ task: "bad" }), null);
  const req = validateAiHelperRequest({ task: "title-suggestions", studentTopicKo: "a".repeat(500), tone: "middle-school", maxSuggestions: 99 });
  assert.ok(req);
  assert.equal(req.studentTopicKo?.length, 200);
  assert.equal(req.maxSuggestions, 5);
  const out = buildTemplateFallbackSuggestions(req);
  assert.ok(out.length > 0);
  assert.equal(out[0].generatedBy, "template-fallback");
});

test("ai helper guardrails", () => {
  const route = fs.readFileSync("app/api/edu/courseware/ai-helper/route.ts", "utf8");
  assert.match(route, /isCoursewareAiHelperEnabled/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_/);
  const lessonPage = fs.readFileSync("app/edu/lesson/_components/ai-helper/CoursewareAiHelperPanel.tsx", "utf8");
  assert.match(lessonPage, /AI 기능이 꺼져 있어도 템플릿 예시로 수업을 계속할 수 있어요/);
  assert.match(lessonPage, /마지막 판단은 학생이 합니다/);
  assert.doesNotMatch(lessonPage, /dangerouslySetInnerHTML/);
});
