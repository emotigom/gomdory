import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const launchpadPath = path.join(process.cwd(), "app/dashboard/classes/[classId]/launch/LaunchpadClient.tsx");
const source = readFileSync(launchpadPath, "utf8");

test("Launchpad includes vibe coding panel title and gating", () => {
  assert.match(source, /바이브코딩 3\/4차시 도구/);
  assert.match(source, /currentLessonTemplateId === "lesson_03_vibe_app_planning"/);
  assert.match(source, /currentLessonTemplateId === "lesson_04_vibe_app_prototype_share"/);
});

test("Launchpad includes lesson template selector options for lesson 03\/04", () => {
  assert.match(source, /일반 수업 \/ 템플릿 없음/);
  assert.match(source, /3차시: Gemini로 AI 웹앱 기획과 프롬프트 설계/);
  assert.match(source, /4차시: Lovable 프로토타입 제작과 제출/);
  assert.match(source, /lessonTemplateId: selectedLessonTemplateId \|\| null/);
});

test("Launchpad vibe panel includes lesson and tool URLs", () => {
  assert.match(source, /\/edu\/vibe-coding\/lesson-03-04/);
  assert.match(source, /https:\/\/gemini\.google\.com\//);
  assert.match(source, /https:\/\/lovable\.dev\//);
});

test("privacy copy includes forbidden SSOT items", async () => {
  const mod = await import("@/lib/edu/vibe-coding/lesson-03-04-launchpad-copy");
  const privacy = mod.VIBE_LAUNCHPAD_COPY.privacyWarning;
  ["실명", "전화번호", "주소", "학교명", "얼굴 사진"].forEach((item) => assert.match(privacy, new RegExp(item)));
});

test("existing student link copy handler remains", () => {
  assert.match(source, /const handleCopyLink = async/);
  assert.match(source, /buildStudentUrl/);
});

test("no new today lesson route or ppt\/pdf generation code added", () => {
  assert.equal(existsSync(path.join(process.cwd(), "app/dashboard/lessons/today")), false);
  const lower = source.toLowerCase();
  assert.equal(/\.ppt|\.pptx|pdfkit|puppeteer/.test(lower), false);
});
