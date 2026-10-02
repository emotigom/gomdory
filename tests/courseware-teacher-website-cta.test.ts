import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const teacherPath = path.join(process.cwd(), "app", "edu", "lesson", "teacher", "CoursewareTeacherDashboardClient.tsx");

test("teacher dashboard has prominent website studio CTA and collapsed sections", () => {
  const source = fs.readFileSync(teacherPath, "utf8");
  assert.match(source, /학생 웹사이트 만들기/);
  assert.match(source, /웹사이트 스튜디오 열기/);
  assert.match(source, /Day 전체 보기/);
  assert.match(source, /도구 체크리스트 펼치기/);
  assert.match(source, /운영 안내 펼치기/);
});
