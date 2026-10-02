import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

function hasTouchActivationContract(source: string) {
  return (
    /CARD_DRAG_TOUCH_ACTIVATION\s*=\s*\{\s*delay:\s*320,\s*tolerance:\s*10\s*\}/.test(source) ||
    (source.includes("@/lib/board/dragSensors") && source.includes("CARD_DRAG_TOUCH_ACTIVATION"))
  );
}

function hasDisabledBeforeHold(source: string) {
  return /const handlePointerDown[\s\S]*?if\s*\(\s*disabled\s*\|\|\s*isInteractiveTarget\(event\.target\)\s*\)\s*return;[\s\S]*?onCardHoldStart\?\.\(card\.id\)/.test(source);
}

function getSortableCardItemSource(source: string) {
  const start = source.indexOf("function SortableCardItem(");
  const end = source.indexOf("function StudentOwnedCardMenu(", start);
  assert.ok(start >= 0 && end > start, "WallColumn must retain the SortableCardItem owner");
  return source.slice(start, end);
}

test("board drag sensors keep stricter touch activation constraints and client wiring", () => {
  const dragSensors = read("lib", "board", "dragSensors.ts");
  const teacherBoard = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardMinimalClient.tsx");
  const studentBoard = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");

  assert.match(
    dragSensors,
    /CARD_DRAG_MOUSE_ACTIVATION\s*=\s*\{\s*distance:\s*4\s*\}/,
    "drag sensor SSOT must keep mouse distance at 4",
  );
  assert.match(
    dragSensors,
    /CARD_DRAG_TOUCH_ACTIVATION\s*=\s*\{\s*delay:\s*320,\s*tolerance:\s*10\s*\}/,
    "drag sensor SSOT must keep touch delay/tolerance at 320/10",
  );

  const teacherDragSensorImport = teacherBoard.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']@\/lib\/board\/dragSensors["']/);
  assert.ok(teacherDragSensorImport, "teacher board must import drag sensors from their shared SSOT");
  assert.match(teacherDragSensorImport[1], /CARD_DRAG_MOUSE_ACTIVATION/, "teacher board must import shared mouse activation");
  assert.match(teacherDragSensorImport[1], /CARD_DRAG_TOUCH_ACTIVATION/, "teacher board must import shared touch activation");
  assert.match(
    teacherBoard,
    /useSensor\(MouseSensor,\s*\{\s*activationConstraint:\s*CARD_DRAG_MOUSE_ACTIVATION,?\s*\}\)/,
    "teacher board must wire the shared mouse activation to MouseSensor",
  );
  assert.match(
    teacherBoard,
    /useSensor\(TouchSensor,\s*\{\s*activationConstraint:\s*CARD_DRAG_TOUCH_ACTIVATION,?\s*\}\)/,
    "teacher board must wire the shared touch activation to TouchSensor",
  );

  assert.ok(hasTouchActivationContract(studentBoard), "student board must keep local 320/10 touch activation or import the shared SSOT");
  assert.match(
    studentBoard,
    /useSensor\(TouchSensor,\s*\{\s*activationConstraint:\s*CARD_DRAG_TOUCH_ACTIVATION,?\s*\}\)/,
    "student board must wire its touch activation to TouchSensor",
  );

  assert.ok(
    hasTouchActivationContract("CARD_DRAG_TOUCH_ACTIVATION = { delay: 320, tolerance: 10 }"),
    "touch activation helper must accept the required 320/10 contract",
  );
  assert.equal(
    hasTouchActivationContract("CARD_DRAG_TOUCH_ACTIVATION = { delay: 200, tolerance: 5 }"),
    false,
    "touch activation helper must reject weaker touch constraints",
  );
});

test("card drag gating blocks disabled cards before hold readiness", () => {
  const wallColumn = read("app", "_components", "WallColumn.tsx");
  const teacherBoard = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardMinimalClient.tsx");
  const studentBoard = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  const sortableCardSource = getSortableCardItemSource(wallColumn);
  const disabledOccurrences = wallColumn.match(/disabled=\{!canDragCard\?\.\(card\.id\)\}/g) ?? [];

  assert.ok(
    disabledOccurrences.length >= 2,
    "WallColumn teacher and student card branches must derive disabled from canDragCard",
  );
  assert.ok(hasDisabledBeforeHold(sortableCardSource), "SortableCardItem must block disabled or interactive cards before starting hold readiness");

  assert.match(teacherBoard, /canDragCard=\{canDragCard\}/, "teacher board must pass canDragCard to WallColumn");
  assert.match(
    teacherBoard,
    /activationConstraint:\s*CARD_DRAG_TOUCH_ACTIVATION/,
    "teacher board must retain shared touch sensor wiring",
  );
  assert.match(
    studentBoard,
    /const onCardHoldStart\s*=\s*useCallback\(\(cardId:\s*string\)\s*=>\s*\{\s*if\s*\(\s*!canDragCard\(cardId\)\s*\)\s*return;[\s\S]*?(?:setTimeout|setDragReadyCardId)/,
    "student board must check canDragCard before scheduling drag-ready state",
  );

  assert.ok(
    hasDisabledBeforeHold(`const handlePointerDown = (event) => {
      if (disabled || isInteractiveTarget(event.target)) return;
      onCardHoldStart?.(card.id);
    };`),
    "pointer-down helper must accept disabled-before-hold ordering",
  );
  assert.equal(
    hasDisabledBeforeHold(`const handlePointerDown = (event) => {
      onCardHoldStart?.(card.id);
      if (disabled) return;
    };`),
    false,
    "pointer-down helper must reject hold-before-disabled ordering",
  );
});
