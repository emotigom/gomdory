import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const boardSource = fs.readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");

test("panel title exists", () => {
  assert.match(boardSource, /바이브코딩 제출물/);
});

test("visible only for lesson_03\/lesson_04 via helper", () => {
  assert.match(boardSource, /isVibeCodingLessonTemplateId\(activeLessonTemplateId\)/);
});

test("classifier is used", () => {
  assert.match(boardSource, /classifyVibeSubmission\(/);
});

test("filters include all required labels", () => {
  for (const label of ["전체", "앱 아이디어", "AI 프롬프트", "작품 링크", "Canva 시안", "실패 기록", "친구 피드백", "링크 있음", "첨부 있음"]) {
    assert.match(boardSource, new RegExp(label));
  }
});

test("no public showcase route is added", () => {
  assert.doesNotMatch(boardSource, /showcase|publish/i);
});

test("no new DB table or migration is added", () => {
  const files = fs.readdirSync(".");
  assert.equal(files.includes("migrations"), false);
});

test("existing teacher board render path remains present", () => {
  const pageSource = fs.readFileSync("app/dashboard/boards/[boardId]/board/page.tsx", "utf8");
  assert.match(pageSource, /TeacherBoardCanonicalClient/);
});
