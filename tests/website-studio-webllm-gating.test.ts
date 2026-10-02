import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
const starter = fs.readFileSync("app/dashboard/websites/new/WebsiteStudioStarterClient.tsx", "utf8");
const review = fs.readFileSync("app/dashboard/websites/[siteId]/review/WebsiteStudioReviewClient.tsx", "utf8");
const publicRoute = fs.readFileSync("app/w/[slug]/page.tsx", "utf8");
const teacher = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");

test("website studio remains usable without WebLLM and AI controls are transparently gated", () => {
  assert.match(editor, /AI 도움은 현재 이 기기에서 사용할 수 없습니다\./);
  assert.match(editor, /직접 편집과 템플릿만으로도 웹사이트를 완성할 수 있습니다\./);
  assert.match(editor, /AI 요청 \(준비 중\)/);
  assert.match(editor, /disabled=\{runInFlightRef\.current\}/);
});

test("non-AI surfaces do not import webllm runtime", () => {
  for (const src of [starter, editor, review, publicRoute, teacher]) {
    assert.doesNotMatch(src, /@mlc-ai\/web-llm|import\(["']@mlc-ai\/web-llm["']\)|createWebLLM|initWebLLM|useWebLLM/);
  }
});
