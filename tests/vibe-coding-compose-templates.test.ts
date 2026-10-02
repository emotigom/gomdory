import test from "node:test";
import assert from "node:assert/strict";

import { LESSON_03_04_VIBE_CODING_CONTENT } from "@/lib/edu/vibe-coding/lesson-03-04-content";
import {
  VIBE_COMPOSE_TEMPLATES,
  insertVibeTemplateText,
} from "@/lib/edu/vibe-coding/lesson-03-04-compose-templates";
import { isVibeCodingLessonTemplateId } from "@/lib/edu/vibe-coding/lesson-03-04-ids";

const REQUIRED_LABELS = [
  "앱 아이디어 제출",
  "AI 프롬프트 제출",
  "작품 링크 제출",
  "Canva 시안 제출",
  "실패 기록 제출",
  "친구 피드백",
];

test("VIBE_COMPOSE_TEMPLATES includes all required labels", () => {
  const labels = VIBE_COMPOSE_TEMPLATES.map((template) => template.label);
  for (const required of REQUIRED_LABELS) {
    assert.ok(labels.includes(required), `missing label: ${required}`);
  }
});

test("template bodies are derived from LESSON_03_04_VIBE_CODING_CONTENT worksheets", () => {
  for (const template of VIBE_COMPOSE_TEMPLATES) {
    const worksheet = LESSON_03_04_VIBE_CODING_CONTENT.worksheets.find((item) => item.key === template.key);
    assert.ok(worksheet);
    assert.match(template.body, new RegExp(`^\\[${worksheet.title}\\]`));
    for (const field of worksheet.fields) {
      assert.ok(template.body.includes(field), `field missing for ${worksheet.key}: ${field}`);
    }
  }
});

test("insertVibeTemplateText replaces empty text", () => {
  assert.equal(insertVibeTemplateText("   ", "템플릿 본문"), "템플릿 본문");
});

test("insertVibeTemplateText appends template with blank line", () => {
  assert.equal(insertVibeTemplateText("기존 텍스트\n", "템플릿 본문"), "기존 텍스트\n\n템플릿 본문");
});

test("isVibeCodingLessonTemplateId matches lesson 03/04 template ids", () => {
  assert.equal(isVibeCodingLessonTemplateId("lesson_03_vibe_app_planning"), true);
  assert.equal(isVibeCodingLessonTemplateId("lesson_04_vibe_app_prototype_share"), true);
  assert.equal(isVibeCodingLessonTemplateId("lesson_02_other"), false);
  assert.equal(isVibeCodingLessonTemplateId(null), false);
});
