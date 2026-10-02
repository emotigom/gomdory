import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const teacher = readFileSync("app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx", "utf8");
const student = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");

test("teacher keeps manual controls and exposes the weekly auto-publish state", () => {
  for (const text of [
    "6시간 열기",
    "이번 주 앱 제출 열기 · 즉시 공개",
    "검사를 통과한 작품은 제출 직후 공개됩니다.",
    "제출은 7월 19일 일요일 밤까지 열립니다.",
    "공개된 작품은 언제든 숨길 수 있습니다.",
    "제출 즉시 공개 중",
    "종료: 7월 19일 일요일 23:59",
    "제출 종료",
    "갤러리에 공개",
    "공개 해제",
  ]) assert.equal(teacher.includes(text), true, text);
  assert.match(teacher, /mutateClassSession\("startAutoPublish"\)/);
  assert.match(teacher, /mutateClassSession\("start"\)/);
  assert.match(teacher, /mutateClassSession\("end"\)/);
});

test("student sees distinct success and recoverable publish-failure outcomes", () => {
  for (const text of [
    "제출과 공개가 완료되었습니다.",
    "내 작품 열기",
    "공개 주소 복사",
    "작품 제출은 완료되었습니다.",
    "공개 링크를 만드는 중 문제가 생겼습니다.",
    "선생님이 확인할 수 있습니다.",
  ]) assert.equal(student.includes(text), true, text);
  assert.doesNotMatch(student, /승인 대기/);
});
