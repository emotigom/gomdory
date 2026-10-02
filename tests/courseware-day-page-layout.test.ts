import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const day01 = fs.readFileSync("app/edu/lesson/_components/studio/Day01LessonStudio.tsx", "utf8");

test("active lesson hero appears before secondary course map", () => {
  const hero = day01.indexOf("Day 1 · AI와 사람의 역할");
  const courseMap = day01.indexOf("전체 코스 맵 (보조 패널)");
  assert.ok(hero >= 0);
  assert.ok(courseMap >= 0);
  assert.ok(hero < courseMap);
});

test("course map and teacher guide are secondary by default", () => {
  assert.ok(day01.includes("const [showCourseMap, setShowCourseMap] = useState(false)"));
  assert.ok(day01.includes("교사 가이드 (보조 섹션)"));
  assert.ok(day01.includes("<details"));
});
