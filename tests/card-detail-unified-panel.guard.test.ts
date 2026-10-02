import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8");
}

test("teacher and student boards use CardDetailPanelWithQuery", () => {
  const teacherBoard = read("app/dashboard/boards/[boardId]/grid/TeacherGridBoard.tsx");
  const studentBoard = read("app/s/[code]/grid/StudentGridBoard.tsx");

  assert.match(teacherBoard, /CardDetailPanelWithQuery/);
  assert.doesNotMatch(teacherBoard, /CardDetailOverlayWithQuery/);

  assert.match(studentBoard, /CardDetailPanelWithQuery/);
  assert.doesNotMatch(studentBoard, /CardDetailOverlayWithQuery/);
});
