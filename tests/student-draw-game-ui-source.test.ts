import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("student draw game modal keeps board-scoped localStorage contract", () => {
  const source = fs.readFileSync(
    "app/dashboard/boards/[boardId]/board/_components/StudentDrawGameModal.tsx",
    "utf8",
  );

  assert.match(source, /gomdory:student-draw-game:\$\{boardId\}/);
  assert.match(source, /window\.localStorage\.getItem\(storageKey\(boardId\)\)/);
  assert.match(source, /window\.localStorage\.setItem\(storageKey\(boardId\), JSON\.stringify\(stored\)\)/);
  assert.match(source, /excludedIds/);
  assert.match(source, /manualParticipants/);
  assert.match(source, /alreadyPickedIds/);
  assert.match(source, /lastMode/);
});

test("student draw game modal hardens browser storage and clipboard failures", () => {
  const source = fs.readFileSync(
    "app/dashboard/boards/[boardId]/board/_components/StudentDrawGameModal.tsx",
    "utf8",
  );

  assert.match(source, /export function normalizeStudentDrawStoredState/);
  assert.match(source, /JSON\.parse\(raw\)/);
  assert.match(source, /catch \{\s*return \{\};\s*\}/);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /catch \{\s*setStatusMessage\("브라우저 저장공간에 현재 상태를 저장하지 못했어요\."\)/);
  assert.match(source, /typeof navigator === "undefined"/);
  assert.match(source, /복사에 실패했어요\. 결과를 직접 선택해 복사해 주세요\./);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /event\.stopPropagation\(\)/);
});
