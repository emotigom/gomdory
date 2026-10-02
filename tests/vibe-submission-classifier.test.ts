import assert from "node:assert/strict";
import test from "node:test";

import { classifyVibeSubmission } from "@/lib/edu/vibe-coding/vibe-submission-classifier";

test("detects major tool links", () => {
  assert.equal(classifyVibeSubmission({ text: "https://my.lovable.dev/demo" }).sourceTool, "lovable");
  assert.equal(classifyVibeSubmission({ text: "Gemini https://gemini.google.com/" }).sourceTool, "gemini");
  assert.equal(classifyVibeSubmission({ text: "https://bolt.new/" }).sourceTool, "bolt");
  assert.equal(classifyVibeSubmission({ text: "https://replit.com/@team/app" }).sourceTool, "replit");
  assert.equal(classifyVibeSubmission({ text: "https://v0.dev/chat" }).sourceTool, "v0");
  assert.equal(classifyVibeSubmission({ text: "https://www.canva.com/design/abc" }).sourceTool, "canva");
});

test("detects prompt/work/rescue templates", () => {
  assert.equal(classifyVibeSubmission({ text: "Gemini가 정리해준 Lovable용 프롬프트" }).submissionMode, "prompt");
  assert.equal(classifyVibeSubmission({ text: "[작품 링크 제출]\n작품 링크:" }).submissionMode, "work_link");
  assert.equal(classifyVibeSubmission({ text: "[실패 기록 제출]\n막힌 부분:" }).submissionMode, "rescue");
});
