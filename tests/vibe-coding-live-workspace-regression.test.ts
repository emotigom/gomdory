import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/lesson-activities/StudentActivityPanel.tsx"),
  "utf8",
);

test("live workspace includes vibe coding guide copy and links", () => {
  assert.match(workspaceSource, /3차시: Gemini로 앱 기획과 프롬프트 설계/);
  assert.match(workspaceSource, /4차시: Lovable 프로토타입 제작과 제출/);
  assert.match(workspaceSource, /\/edu\/vibe-coding\/lesson-03-04/);
  assert.match(workspaceSource, /https:\/\/gemini\.google\.com\//);
  assert.match(workspaceSource, /https:\/\/lovable\.dev\//);
  assert.match(workspaceSource, /실명, 전화번호, 주소, 학교명, 얼굴 사진은 넣지 마세요/);
});

test("lesson material and external links open in new tabs while board view remains in-app action", () => {
  assert.match(workspaceSource, /<Link href="\/edu\/vibe-coding\/lesson-03-04" target="_blank" rel="noreferrer"[^>]*>강의자료 열기<\/Link>/);
  assert.match(workspaceSource, /<a href="https:\/\/gemini\.google\.com\/" target="_blank" rel="noreferrer"[^>]*>Gemini 열기<\/a>/);
  assert.match(workspaceSource, /<a href="https:\/\/lovable\.dev\/" target="_blank" rel="noreferrer"[^>]*>Lovable 열기<\/a>/);
  assert.match(workspaceSource, /<button type="button" onClick=\{onOpenBoard\}[^>]*>보드 보기로 이동<\/button>/);
  assert.doesNotMatch(workspaceSource, /<a[^>]*>보드 보기로 이동<\/a>/);
  assert.doesNotMatch(workspaceSource, /<Link[^>]*>보드 보기로 이동<\/Link>/);
});

test("lesson 03/04 are routed to guide instead of Web Studio Lite runtime", () => {
  assert.match(workspaceSource, /isVibeCodingLessonTemplateId/);
  assert.match(workspaceSource, /templateId === "lesson_03_vibe_app_planning"/);
  assert.match(workspaceSource, /templateId === "lesson_04_vibe_app_prototype_share"/);
  assert.doesNotMatch(workspaceSource, /lesson_03_vibe_app_planning[\s\S]{0,200}web_coding_lite/);
  assert.doesNotMatch(workspaceSource, /lesson_04_vibe_app_prototype_share[\s\S]{0,200}web_coding_lite/);
});
