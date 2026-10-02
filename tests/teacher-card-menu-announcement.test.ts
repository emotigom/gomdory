import { strict as assert } from "node:assert";
import test from "node:test";
import { createTeacherCardMenuAnnouncement } from "@/lib/board/teacherCardMenuAnnouncement";
import { createTeacherBoardOperation } from "@/lib/board/teacherBoardMutationState";

const visibility = (sequence = 1) =>
  createTeacherBoardOperation("visibility", "card-a", 4, sequence);

test("teacher card-menu announcement maps canonical visibility terminal results", () => {
  const hide = createTeacherCardMenuAnnouncement(visibility(), "hide", "confirmed");
  const restore = createTeacherCardMenuAnnouncement(visibility(2), "restore", "confirmed");
  assert.deepEqual(hide, {
    kind: "success",
    operation: "hide",
    eventKey: "visibility:card-a:4:1:confirmed",
    message: "카드를 학생 화면에서 숨겼습니다.",
  });
  assert.equal(restore?.message, "카드를 학생 화면에 다시 표시했습니다.");
  assert.notEqual(hide?.message, restore?.message);
});

test("teacher card-menu announcement ignores pending, reconciliation, and rollback", () => {
  for (const result of ["rolled-back", "reconciled"] as const) {
    assert.equal(createTeacherCardMenuAnnouncement(visibility(), "hide", result), null);
  }
});

test("teacher card-menu announcement retains safe retryable and terminal error categories", () => {
  const retryable = createTeacherCardMenuAnnouncement(visibility(), "hide", "retryable-error");
  const terminal = createTeacherCardMenuAnnouncement(visibility(), "restore", "terminal-error");
  assert.equal(retryable?.kind, "retryable-error");
  assert.equal(retryable?.message, "카드 공개 상태를 바꾸지 못했어요. 다시 시도해주세요.");
  assert.equal(terminal?.kind, "terminal-error");
  assert.equal(terminal?.message, "카드 공개 상태를 바꿀 수 없습니다.");
});

test("teacher card-menu announcement event keys dedupe one operation and permit a retry", () => {
  const seen = new Set<string>();
  const first = createTeacherCardMenuAnnouncement(visibility(), "hide", "confirmed");
  const sameReflection = createTeacherCardMenuAnnouncement(visibility(), "hide", "confirmed");
  const retry = createTeacherCardMenuAnnouncement(visibility(2), "hide", "confirmed");
  assert.ok(first && sameReflection && retry);
  assert.equal(seen.has(first.eventKey), false);
  seen.add(first.eventKey);
  assert.equal(seen.has(sameReflection.eventKey), true);
  assert.equal(seen.has(retry.eventKey), false);
});
