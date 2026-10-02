import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAllCoursewareLessons } from "../lib/edu/courseware/aiCoursewareSelectors";
import { getDraftStatus, makeEmptyDraftFromLesson } from "../lib/edu/courseware/aiCoursewareDraftTypes";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("lesson card includes artifact workspace action", () => {
  const card = read("app", "edu", "lesson", "_components", "CoursewareLessonCard.tsx");
  const client = read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx");
  assert.match(card, /결과물 작성하기/);
  assert.match(client, /이어 쓰기/);
  assert.match(client, /결과물 확인/);
});

test("workspace renders required copy and fallback guidance", () => {
  const workspace = read("app", "edu", "lesson", "_components", "CoursewareArtifactWorkspace.tsx");
  assert.match(workspace, /오늘 남길 결과물/);
  assert.match(workspace, /복구 예시로 시작하기/);
  assert.match(workspace, /개인정보는 적지 않아요/);
});

test("draft status and editor routing supports required types", () => {
  const editor = read("app", "edu", "lesson", "_components", "CoursewareArtifactEditor.tsx");
  assert.match(editor, /revision-comparison/);
  assert.match(editor, /safety-check/);
  assert.match(editor, /GenericArtifactEditor/);
});

test("text draft can transition empty -> draft -> complete", () => {
  const lesson = getAllCoursewareLessons()[0];
  const draft = makeEmptyDraftFromLesson(lesson);
  assert.equal(getDraftStatus(draft), "empty");
  const edited = { ...draft, bodyKo: "초안" };
  assert.equal(getDraftStatus(edited), "draft");
  assert.equal(getDraftStatus({ ...edited, isComplete: true }), "complete");
});

test("ui files do not duplicate lesson seed literals", () => {
  const source = [
    read("app", "edu", "lesson", "CoursewareStudioCanonicalClient.tsx"),
    read("app", "edu", "lesson", "_components", "CoursewareArtifactWorkspace.tsx"),
  ].join("\n");
  assert.doesNotMatch(source, /lesson-01-ai-bingo/);
  assert.doesNotMatch(source, /lesson-32-reflection-card/);
});

test("no server API route or webllm usage added in workspace modules", () => {
  const workspace = read("app", "edu", "lesson", "_components", "CoursewareArtifactWorkspace.tsx");
  assert.doesNotMatch(workspace, /fetch\(/);
  assert.doesNotMatch(workspace, /webllm/i);
});
