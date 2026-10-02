import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const teacherBoardSource = readFileSync(
  "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
  "utf8",
);

test("TeacherBoardCanonicalClient wires pointer long-press drag preview through teacherCardDrag helpers", () => {
  assert.match(teacherBoardSource, /from "@\/lib\/board\/teacherCardDrag"/);
  assert.match(teacherBoardSource, /TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS/);
  assert.match(teacherBoardSource, /TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX/);
  assert.match(teacherBoardSource, /isTeacherCardDragPointerCandidate/);
  assert.match(teacherBoardSource, /isCardDragBlockedTarget/);
  assert.match(teacherBoardSource, /calculateTeacherCardDropPosition/);
  assert.match(teacherBoardSource, /handleTeacherCardPointerDown/);
  assert.match(teacherBoardSource, /onPointerDown=/);
  assert.match(teacherBoardSource, /setPointerCapture/);
});

test("canonical drag preview exposes non-interactive overlay and drop indicator markers", () => {
  assert.match(teacherBoardSource, /data-testid="teacher-card-drag-overlay"/);
  assert.match(teacherBoardSource, /data-testid="teacher-card-drop-indicator"/);
  assert.match(teacherBoardSource, /pointer-events-none fixed z-\[10020\]/);
  assert.match(teacherBoardSource, /data-teacher-card-dragging-origin/);
  assert.match(teacherBoardSource, /data-teacher-wall-dropzone="true"/);
  assert.match(teacherBoardSource, /data-teacher-wall-scroll-container="true"/);
});

test("canonical drag drop saves through dashboard move API with optimistic rollback guards", () => {
  assert.match(teacherBoardSource, /event\.key === "Escape"/);
  assert.match(teacherBoardSource, /cancelTeacherCardDrag\(\)/);
  assert.match(teacherBoardSource, /persistTeacherCardDragMove/);
  assert.match(teacherBoardSource, /applyTeacherCardMoveOptimistic/);
  assert.match(teacherBoardSource, /isNoopTeacherCardMove/);
  assert.match(teacherBoardSource, /teacherCardMoveInFlight/);
  assert.match(teacherBoardSource, /data-moving-card-id/);
  assert.doesNotMatch(teacherBoardSource, /console\.debug\("teacher-card-drag-preview-target"/);

  const pointerUpBody = teacherBoardSource.match(
    /const handleTeacherCardPointerUp =[\s\S]*?;\n\n  const handleTeacherCardPointerCancel/,
  )?.[0];
  assert.ok(pointerUpBody, "pointerup handler should be easy to inspect");
  assert.match(pointerUpBody, /persistTeacherCardDragMove\(moveState\)/);

  const persistBody = teacherBoardSource.match(
    /const persistTeacherCardDragMove = async[\s\S]*?;\n\n  const handleTeacherCardPointerUp/,
  )?.[0];
  assert.ok(persistBody, "move persistence should be easy to inspect");
  assert.match(persistBody, /routes\.api\.v1\("dashboard", "cards", draggingCardId, "move"\)/);
  assert.match(persistBody, /boardId/);
  assert.match(persistBody, /wallId: targetWallId/);
  assert.match(persistBody, /position: targetPosition/);
  assert.match(persistBody, /clientMutationId: createTeacherCardMoveMutationId\(draggingCardId\)/);
  assert.match(persistBody, /setBoardWalls\(optimisticMove\.entries\)/);
  assert.match(persistBody, /setBoardWalls\(previousWalls\)/);
  assert.match(persistBody, /카드 이동을 저장하지 못했어요/);
});

test("canonical drag preview keeps interactive targets blocked", () => {
  assert.match(teacherBoardSource, /data-no-card-drag/);
  assert.match(teacherBoardSource, /if \(isCardDragBlockedTarget\(event\.target\)\) return/);
  assert.match(teacherBoardSource, /const teacherCardDragEnabled = canDeleteCards && !movingTeacherCardId/);
});

test("canonical drag auto-scroll runs only while dragging and cancels its animation frame", () => {
  assert.match(teacherBoardSource, /calculateTeacherCardAutoScrollDelta/);
  assert.match(teacherBoardSource, /teacherCardAutoScrollRafRef/);
  assert.match(teacherBoardSource, /requestAnimationFrame\(tick\)/);
  assert.match(teacherBoardSource, /cancelAnimationFrame\(teacherCardAutoScrollRafRef\.current\)/);
  assert.match(teacherBoardSource, /cancelTeacherCardAutoScrollLoop\(\)/);

  const autoScrollBody = teacherBoardSource.match(
    /const scheduleTeacherCardAutoScrollLoop = \(\) => \{[\s\S]*?\n  \};\n\n  const startTeacherCardDragging/,
  )?.[0];
  assert.ok(autoScrollBody, "auto-scroll loop should be easy to inspect");
  assert.match(autoScrollBody, /dragState\.phase !== "dragging"/);
  assert.match(autoScrollBody, /teacherCardMoveInFlight\.current/);
  assert.match(autoScrollBody, /getTeacherCardHorizontalScroller\(\)/);
  assert.match(autoScrollBody, /getTeacherCardWallScrollContainer\(dragState\.targetWallId\)/);
  assert.match(autoScrollBody, /updateTeacherCardDropTargetFromPointer\(pointer\)/);

  const pointerUpBody = teacherBoardSource.match(
    /const handleTeacherCardPointerUp =[\s\S]*?;\n\n  const handleTeacherCardPointerCancel/,
  )?.[0];
  assert.ok(pointerUpBody, "pointerup handler should be easy to inspect");
  assert.match(pointerUpBody, /cancelTeacherCardAutoScrollLoop\(\)/);
});
