import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAllCoursewareLessons, getCoursewareLessonsByDay } from "../lib/edu/courseware/aiCoursewareSelectors";
import { parseTeacherShareInput } from "../lib/edu/courseware/teacher/aiCoursewareTeacherLinkParser";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("teacher dashboard has stable runtime markers", () => {
  const src = read("app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");
  assert.match(src, /data-courseware-teacher-dashboard="ai-courseware-teacher-shell"/);
  assert.match(src, /data-marker-version="ai-courseware-teacher-v1"/);
});

test("teacher dashboard restores local state after hydration", () => {
  const src = read("app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");
  assert.match(src, /useState\(\(\) => createDefaultTeacherDashboardState\(1\)\)/);
  assert.match(src, /useEffect\(\(\) => \{[\s\S]*?loadTeacherDashboardState\(1\)[\s\S]*?setState\(/);
  assert.doesNotMatch(src, /useState\(\(\) => \{\s*const loaded = loadTeacherDashboardState/);
});

test("day picker and selector mapping remain 16 days / 32 lessons", () => {
  const lessons = getAllCoursewareLessons();
  assert.equal(lessons.length, 32);
  assert.equal(new Set(lessons.map((x) => x.dayNumber)).size, 16);
  assert.deepEqual(getCoursewareLessonsByDay(1).map((x) => x.lessonNumber), [1, 2]);
  assert.deepEqual(getCoursewareLessonsByDay(2).map((x) => x.lessonNumber), [3, 4]);
  assert.deepEqual(getCoursewareLessonsByDay(16).map((x) => x.lessonNumber), [31, 32]);
});

test("teacher day selection UI is interactive and not hardcoded", () => {
  const src = read("app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");
  const picker = read("app", "edu", "lesson", "teacher", "_components", "TeacherDayPicker.tsx");
  const panel = read("app", "edu", "lesson", "teacher", "_components", "TeacherTodayRunPanel.tsx");
  assert.match(src, /selectedDayNumber/);
  assert.match(src, /<TeacherDayPicker selectedDayNumber=\{selectedDayNumber\} onSelectDay=\{onSelectDay\}/);
  assert.match(picker, /Array\.from\(\{ length: 16 \}/);
  assert.match(picker, /type="button"/);
  assert.match(picker, /선택됨 · 오늘 운영 중/);
  assert.match(panel, /Day \{dayNumber\} 오늘의 수업 운영/);
  assert.doesNotMatch(src, /getCoursewareLessonsByDay\(1\)\.map/);
});

test("manual link parser accepts valid public URL and raw shareId, rejects external url", () => {
  const urlParsed = parseTeacherShareInput("https://www.gomdory.com/edu/courseware/p/abc12345", "https://www.gomdory.com");
  assert.equal(urlParsed?.shareId, "abc12345");
  const idParsed = parseTeacherShareInput("abc12345", "https://www.gomdory.com");
  assert.equal(idParsed?.publicUrl, "https://www.gomdory.com/edu/courseware/p/abc12345");
  assert.equal(parseTeacherShareInput("https://evil.com/edu/courseware/p/abc12345"), null);
});

test("teacher copy includes required safety/fallback copy", () => {
  const src = read("app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");
  assert.match(src, /WebLLM은 선택 사항/);
  assert.match(src, /raw JS\/HTML은 지원하지 않습니다/);
  assert.match(src, /아직 제출된 링크가 없어요/);
  assert.match(src, /수업 코드 기능이 꺼져 있으면 수동 링크 수집을 사용하세요/);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
});
