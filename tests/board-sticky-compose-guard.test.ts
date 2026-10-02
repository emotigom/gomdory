import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

const readStickyComposeDock = (source: string, surfaceName: string) => {
  const stickyMarker = "fixed inset-x-0 bottom-0 z-30";
  const markerIndex = source.indexOf(stickyMarker);

  assert.notEqual(markerIndex, -1, `${surfaceName} board keeps a sticky compose dock wrapper`);

  return source.slice(Math.max(0, markerIndex - 160), markerIndex + 2_400);
};

test("board compose CTAs keep sticky wrapper and actionable compose wiring", () => {
  const teacherBoard = read(
    "app",
    "dashboard",
    "boards",
    "[boardId]",
    "board",
    "TeacherBoardMinimalClient.tsx",
  );
  const studentBoard = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const teacherDock = readStickyComposeDock(teacherBoard, "teacher");
  const studentDock = readStickyComposeDock(studentBoard, "student");

  assert.match(teacherDock, /fixed inset-x-0 bottom-0 z-30/);
  assert.match(teacherDock, /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*handleComposeOpen\(stickyComposeWallId\)\s*\}/);
  assert.match(teacherDock, /disabled\s*=\s*\{\s*!stickyComposeWallId\s*\}/);
  assert.match(teacherDock, /aria-label\s*=\s*["'][^"']*카드 작성[^"']*["']/);
  assert.match(teacherDock, /<button\b[^>]*>[\s\S]*?카드 작성(?:\/추가)?[\s\S]*?<\/button>/);

  assert.match(studentDock, /fixed inset-x-0 bottom-0 z-30/);
  assert.match(studentDock, /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*openCompose\(composeWallId\s*\|\|\s*composeWalls\[0\]\?\.id\s*\|\|\s*["']{2}\)\s*\}/);
  assert.match(studentDock, /disabled\s*=\s*\{\s*writeLocked\s*\|\|\s*composeWalls\.length\s*===\s*0\s*\}/);
  assert.match(studentDock, /aria-label\s*=\s*["'][^"']*카드 작성[^"']*["']/);
  assert.match(studentDock, /<button\b[^>]*>[\s\S]*?카드 작성(?:\/추가)?[\s\S]*?<\/button>/);
});
