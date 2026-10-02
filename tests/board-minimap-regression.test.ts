import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const MINIMAP_FILE = path.join(process.cwd(), "app/_components/BoardMiniMap.tsx");
const STUDENT_FILE = path.join(process.cwd(), "app/s/[code]/_components/StudentBoardMinimal.tsx");
const TEACHER_FILE = path.join(process.cwd(), "app/dashboard/boards/[boardId]/board/TeacherBoardMinimalClient.tsx");

test("toggle minimap trigger stays above safe-area bottom and panel is viewport-clamped", () => {
  const content = fs.readFileSync(MINIMAP_FILE, "utf8");

  assert.match(content, /data-testid="board-minimap-trigger"/);
  assert.match(content, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+1\.5rem\)\]/);
  assert.match(content, /height:\s*"min\(240px, 28vh\)"/);
  assert.match(content, /width:\s*"min\(360px, calc\(100vw - 2rem\)\)"/);
  assert.match(content, /className="max-w-\[calc\(100vw-2rem\)\] overflow-hidden/);
});

test("student and teacher board routes both mount BoardMiniMap", () => {
  const student = fs.readFileSync(STUDENT_FILE, "utf8");
  const teacher = fs.readFileSync(TEACHER_FILE, "utf8");

  assert.match(student, /<BoardMiniMap mode=\{minimapMode\} scrollRef=\{scrollRef\} columnCount=\{columns\.length\} \/>/);
  assert.match(teacher, /<BoardMiniMap\s+[\s\S]*mode=\{minimapMode\}[\s\S]*scrollRef=\{scrollRef\}/);
});
