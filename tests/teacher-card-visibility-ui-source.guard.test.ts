import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const teacherBoardSource = fs.readFileSync(
  path.join(process.cwd(), "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx"),
  "utf8",
);
const studentBoardSource = fs.readFileSync(
  path.join(process.cwd(), "app/s/[code]/_components/StudentBoardMinimal.tsx"),
  "utf8",
);

const EXACT_POSITION_EXPRESSION = "position: payload.card!.position,";
const EXACT_CAN_OPERATE_CARDS_FRAGMENT =
  "disabled={visibilityInFlight || !canOperateCards}";

function assertTeacherCardVisibilityContract(source: string) {
  const actionBody = source.match(
    /async function updateCardVisibility[\s\S]*?\n  }\n\n  async function updateFinalArtwork/,
  )?.[0];
  assert.ok(actionBody, "visibility update action should be easy to inspect");

  assert.match(
    actionBody,
    /catch \(error\) \{[\s\S]*?setBoardWalls\(previousWalls\)/,
    "visibility failures must use the current catch parameter and rollback",
  );
  assert.match(
    actionBody,
    /is_hidden:\s*payload\.card!\.isHidden,\s*hidden_at:\s*payload\.card!\.hiddenAt \?\? null,\s*position:\s*payload\.card!\.position,/,
    "visibility reconciliation must preserve the server position",
  );

  const menuBody = source.match(
    /<MoreMenu\s+label="카드 메뉴 열기"[\s\S]*?<\/MoreMenu>/,
  )?.[0];
  assert.ok(menuBody, "card MoreMenu should be easy to inspect");
  assert.match(
    menuBody,
    /disabled=\{visibilityInFlight \|\| !canOperateCards\}/,
    "visibility controls must fail closed without card-operation permission",
  );
}

test("teacher card more menu exposes student visibility toggle labels in the expected area", () => {
  const menuBody = teacherBoardSource.match(
    /<MoreMenu\s+label="카드 메뉴 열기"[\s\S]*?<\/MoreMenu>/,
  )?.[0];
  assert.ok(menuBody, "card MoreMenu should be easy to inspect");
  assert.match(menuBody, /크게 보기[\s\S]*학생에게 공개하기[\s\S]*학생에게 숨기기[\s\S]*카드 색상 변경/);
});

test("teacher card visibility toggle calls the visibility endpoint with hidden boolean body", () => {
  const actionBody = teacherBoardSource.match(
    /async function updateCardVisibility[\s\S]*?\n  }\n\n  async function updateFinalArtwork/,
  )?.[0];
  assert.ok(actionBody, "visibility update action should be easy to inspect");
  assert.match(actionBody, /routes\.api\.v1\("dashboard", "cards", cardId, "visibility"\)/);
  assert.match(actionBody, /method: "POST"/);
  assert.match(actionBody, /"Content-Type": "application\/json"/);
  assert.match(actionBody, /body: JSON\.stringify\(\{ hidden \}\)/);
});

test("teacher card visibility toggle optimistically updates only hidden fields and rolls back on failure", () => {
  const actionBody = teacherBoardSource.match(
    /async function updateCardVisibility[\s\S]*?\n  }\n\n  async function updateFinalArtwork/,
  )?.[0];
  assert.ok(actionBody, "visibility update action should be easy to inspect");
  assert.match(actionBody, /const previousWalls = boardWalls/);
  assert.match(actionBody, /is_hidden: hidden/);
  assert.match(actionBody, /hidden_at: optimisticHiddenAt/);
  assert.match(actionBody, /카드 공개 상태를 바꾸지 못했어요\. 다시 시도해주세요\./);
  assert.doesNotMatch(actionBody, /wall_id|text|card_color_token|attachments/);
  assertTeacherCardVisibilityContract(teacherBoardSource);
});

test("teacher card visibility guard rejects position and permission contract regressions", () => {
  assertTeacherCardVisibilityContract(teacherBoardSource);

  assert.equal(
    teacherBoardSource.split(EXACT_POSITION_EXPRESSION).length - 1,
    1,
    "position preservation fragment must have one exact mutation target",
  );
  const withoutPositionPreservation = teacherBoardSource.replace(
    EXACT_POSITION_EXPRESSION,
    "position: 0,",
  );
  assert.notEqual(withoutPositionPreservation, teacherBoardSource);
  assert.throws(() =>
    assertTeacherCardVisibilityContract(withoutPositionPreservation),
  );

  assert.equal(
    teacherBoardSource.split(EXACT_CAN_OPERATE_CARDS_FRAGMENT).length - 1,
    1,
    "card-operation permission fragment must have one exact mutation target",
  );
  const withoutCanOperateCards = teacherBoardSource.replace(
    EXACT_CAN_OPERATE_CARDS_FRAGMENT,
    "disabled={visibilityInFlight}",
  );
  assert.notEqual(withoutCanOperateCards, teacherBoardSource);
  assert.throws(() =>
    assertTeacherCardVisibilityContract(withoutCanOperateCards),
  );
});

test("teacher hidden cards render a badge and restrained visual treatment", () => {
  assert.match(teacherBoardSource, /학생에게 숨김/);
  assert.match(teacherBoardSource, /isHiddenFromStudents \? "border border-dashed border-cyan-300\/45 opacity-85 ring-cyan-300\/45"/);
});

test("visibility menu item is drag-safe and disabled while the same card is toggling", () => {
  const menuBody = teacherBoardSource.match(
    /<MoreMenu\s+label="카드 메뉴 열기"[\s\S]*?<\/MoreMenu>/,
  )?.[0];
  assert.ok(menuBody, "card MoreMenu should be easy to inspect");
  assert.match(menuBody, /data-no-card-drag[\s\S]*updateCardVisibility/);
  assert.match(menuBody, /disabled=\{visibilityInFlight \|\| !canOperateCards\}/);
  assert.match(teacherBoardSource, /const \[visibilityCardIds, setVisibilityCardIds\]/);
});

test("student board source stays free of card visibility UI and hidden placeholders", () => {
  assert.doesNotMatch(studentBoardSource, /학생에게 숨김|학생에게 숨기기|학생에게 공개하기/);
  assert.doesNotMatch(studentBoardSource, /cards", [^)]*"visibility"|\/visibility/);
  assert.doesNotMatch(studentBoardSource, /data-card-visibility|hidden-card|visibilityCardIds/);
});
