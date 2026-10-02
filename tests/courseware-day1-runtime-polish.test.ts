import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const student = fs.readFileSync("app/edu/lesson/day/[day]/StudentLessonRuntimeClient.tsx", "utf8");
const teacher = fs.readFileSync("app/edu/lesson/teacher/day/[day]/page.tsx", "utf8");
const hub = fs.readFileSync("app/edu/lesson/CoursewareStudioCanonicalClient.tsx", "utf8");

test("canonical client keeps both runtime and compatibility markers", () => {
  assert.match(hub, /data-courseware-runtime="lesson-hub-v2"/);
  assert.match(hub, /data-marker-version="ai-courseware-v1"/);
});

test("student day route has guided/full mode and navigation controls", () => {
  assert.match(student, /진행 모드/);
  assert.match(student, /전체 보기/);
  assert.match(student, /이전 활동/);
  assert.match(student, /다음 활동/);
  assert.match(student, /전체 보기로 전환/);
  assert.match(student, /aria-current/);
});

test("student runtime keeps interactive and marker compatibility behavior", () => {
  assert.match(student, /data-courseware-day-runtime="student-day-v2"/);
  assert.match(student, /data-marker-version="ai-courseware-v1"/);
  assert.match(student, /data-lesson-block="interactive-sort"/);
  assert.match(student, /aria-pressed/);
  assert.match(student, /합쳐진 프롬프트 미리보기/);
  assert.match(student, /data-lesson-block="web-card-builder"/);
  assert.match(student, /공유 전 확인/);
  assert.match(student, /오늘의 도구 흐름/);
  assert.match(student, /개인정보 보호 안내/);
});

test("day 1 runtime copy avoids raw metadata and placeholders", () => {
  assert.doesNotMatch(student, /Today Snapshot|lesson artifact|Day 1 unplugged|Day 1 browser-ai-lab|Day 1 gomdory-web-artifact/);
  assert.match(student, /오늘 수업 한눈에 보기/);
  assert.match(student, /브라우저 AI 실험/);
  assert.match(student, /웹 결과물/);
});

test("teacher day route includes pacing and scripts", () => {
  assert.match(teacher, /수업 도구 요약/);
  assert.match(teacher, /준비 체크리스트/);
  assert.match(teacher, /개인정보 \/ 안전 안내/);
  assert.match(teacher, /대체 운영안/);
  assert.match(teacher, /45분 운영/);
  assert.match(teacher, /90분 운영/);
  assert.match(teacher, /120–180분 확장/);
  assert.match(teacher, /첫 수업에서 추천하는 진행 순서/);
  assert.match(teacher, /이제 AI가 잘하는 일과 사람이 판단해야 하는 일을 구분해 봅시다/);
});

test("hub shows modality chips and runtime marker", () => {
  assert.match(hub, /언플러그드/);
  assert.match(hub, /티처블 머신형/);
  assert.match(hub, /data-courseware-runtime="lesson-hub-v2"/);
});

test("no hardcoded day 9 default in student runtime", () => {
  assert.doesNotMatch(student, /day\/9|Day 9|\b9\b default/);
});
