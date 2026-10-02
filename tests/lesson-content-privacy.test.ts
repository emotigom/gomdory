import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildLesson1AiBingoConfig } from "@/lib/lesson-activities/aiBingo";
import { buildLesson2AiJudgmentSortConfig } from "@/lib/lesson-activities/aiJudgmentSort";
import { buildLesson1PythonStudioLiteConfig, buildLesson2PythonStudioLiteConfig } from "@/lib/lesson-activities/pythonStudioLite";
import { buildLesson2WebCodingLiteConfig } from "@/lib/lesson-activities/webCodingLite";
import { LESSON_TEMPLATES } from "@/lib/lesson-activities/registry";

const root = process.cwd();
const bannedStarterPatterns = [
  /전화번호/,
  /주소/,
  /생일/,
  /이메일/,
  /학번/,
  /주민/,
  /이름을 입력/,
  /학교/,
  /010/,
  /@example\.com/,
];

function assertPrivacySafe(label: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  for (const pattern of bannedStarterPatterns) {
    assert.doesNotMatch(text, pattern, `${label} includes banned personal-info starter pattern ${pattern}`);
  }
}

test("official lesson and activity starter content avoids personal-info prompts", () => {
  assertPrivacySafe("lesson registry", LESSON_TEMPLATES);
  assertPrivacySafe("AI Bingo starter", buildLesson1AiBingoConfig());
  assertPrivacySafe("AI Judgment Sort starter", buildLesson2AiJudgmentSortConfig());
  assertPrivacySafe("Web Studio starter", buildLesson2WebCodingLiteConfig());
  assertPrivacySafe("Python Studio lesson 1 starter", buildLesson1PythonStudioLiteConfig());
  assertPrivacySafe("Python Studio lesson 2 starter", buildLesson2PythonStudioLiteConfig());
});

test("allowed classroom-safe terms remain usable in official starters", () => {
  const lesson1 = buildLesson1PythonStudioLiteConfig();
  const lesson2 = buildLesson2PythonStudioLiteConfig();
  assert.match(lesson1.starter.code, /닉네임/);
  assert.match(lesson2.starter.code, /판단할 일/);
  assert.match(lesson2.starter.code, /데이터가 많고 반복되는 일/);
  assert.match(lesson2.starter.code, /감정, 책임, 윤리 판단/);
  assert.match(lesson2.starter.code, /AI 판단 도우미/);
  assertPrivacySafe("Python nickname starter", lesson1.starter);
  assertPrivacySafe("Python lesson 2 judgment starter", lesson2.starter);
});

test("lesson content privacy policy exists and documents official-template guardrails", () => {
  const doc = fs.readFileSync(path.join(root, "docs", "LESSON_CONTENT_PRIVACY.md"), "utf8");
  assert.match(doc, /Official Gomdory lesson templates/);
  assert.match(doc, /must not ask for, display, or encourage entry/);
  assert.match(doc, /nicknames/);
  assert.match(doc, /Teacher-created content can exist/);
});
