import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (...segments: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

test("StudentBoardMinimal source imports and uses mission helper", () => {
  const file = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  assert.match(file, /getVibeCodingStudentMission/);
  assert.match(file, /const mission = getVibeCodingStudentMission\(activeLessonTemplateId\)/);
  assert.match(file, /mission \? \(/);
  assert.match(file, /<VibeCodingMissionBanner/);
});

test("banner visibility is based on activeLessonTemplateId, not board title guessing", () => {
  const file = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  assert.doesNotMatch(file, /title\.includes\(/);
  assert.doesNotMatch(file, /오늘의 미션.*title/);
});

test("mission banner includes 오늘의 미션 and collapse and compose CTA", () => {
  const file = read("app", "s", "[code]", "_components", "VibeCodingMissionBanner.tsx");
  assert.match(file, /오늘의 미션/);
  assert.match(file, /접기/);
  assert.match(file, /펼치기/);
  assert.match(file, /카드 작성하기/);
});

test("compose submission logic path remains untouched", () => {
  const composeFile = read("app", "_components", "ComposeCardPanel.tsx");
  assert.match(composeFile, /routes\.api\.v1\("share", code, "walls", activeWallId, "cards"\)/);
});

test("no new api route or db table added for mission banner", () => {
  const studentBoardFile = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const missionFile = read("lib", "edu", "vibe-coding", "lesson-03-04-student-mission.ts");
  assert.doesNotMatch(studentBoardFile, /app\/api\//);
  assert.doesNotMatch(missionFile, /create table|alter table|migration/i);
});
