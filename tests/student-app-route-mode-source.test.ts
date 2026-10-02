import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("app/s/[code]/page.tsx", "utf8");

test("student share route detects explicit and fallback student app modes", () => {
  assert.match(pageSource, /searchParams\?: Promise<SharedBoardSearchParams>/);
  assert.match(pageSource, /shouldRenderStudentAppMode/);
  assert.match(pageSource, /getSearchParamValue\(searchParams, "view"\)/);
  assert.match(pageSource, /getSearchParamValue\(searchParams, "mode"\)/);
  assert.match(pageSource, /getSearchParamValue\(searchParams, "lessonKit"\)/);
  assert.match(pageSource, /view === "student-app"/);
  assert.match(pageSource, /mode === "coding"/);
  assert.match(pageSource, /lessonKit\.length > 0 && !view && !mode/);
});

test("student app mode renders the submission workspace instead of the board shell", () => {
  assert.match(pageSource, /import StudentAppSubmitPanel/);
  assert.match(pageSource, /import StudentAppGalleryPanel/);
  assert.match(pageSource, /data-page-marker="student-app-coding"/);
  assert.match(pageSource, /data-student-app-route-mode="true"/);
  assert.match(pageSource, /<StudentAppSubmitPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="inline" \/>/);
  assert.match(pageSource, /<StudentAppGalleryPanel boardId=\{boardId\} shareCode=\{shareCode\} \/>/);
  assert.match(pageSource, /href=\{`\/s\/\$\{shareCode\}`\}/);
  assert.match(pageSource, /if \(renderStudentAppMode\)/);
});

test("student app mode labels the route as a direct coding screen", () => {
  assert.match(pageSource, /학생 코딩 화면/);
  assert.match(pageSource, /HTML\/CSS\/JS를 수정하고 오른쪽 미리보기로 확인한 뒤 제출해요/);
  assert.match(pageSource, /친구 작품 보기는 보조 화면/);
  assert.match(pageSource, /학생 보드로 돌아가기/);
});

test("student share route keeps default board and invalid-code paths intact", () => {
  assert.match(pageSource, /if \(!board\)/);
  assert.match(pageSource, /variant="missing"/);
  assert.match(pageSource, /if \(activeLessonSession\)/);
  assert.match(pageSource, /data-page-marker="student-board"/);
  assert.match(pageSource, /<StudentGuestBoardSmartLayer/);
  assert.match(pageSource, /<StudentBoardMinimal \{\.\.\.boardProps\} \/>/);
});
