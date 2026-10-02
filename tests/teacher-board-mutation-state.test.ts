import { strict as assert } from "node:assert";
import test from "node:test";
import {
  confirmTeacherBoardMutation,
  createTeacherBoardOperation,
  failTeacherBoardMutation,
  idleTeacherBoardMutationState,
  isNewerTeacherBoardVersion,
  isStaleTeacherBoardVersion,
  reconcileTeacherBoardMutation,
  rejectStaleTeacherBoardResponse,
  startTeacherBoardMutation,
} from "@/lib/board/teacherBoardMutationState";

test("teacher board mutation lifecycle confirms only the active operation", () => {
  const operation = createTeacherBoardOperation("visibility", "card-a", 4, 1);
  const pending = startTeacherBoardMutation(idleTeacherBoardMutationState(), operation);
  assert.equal(pending.phase, "pending");
  const confirmed = confirmTeacherBoardMutation(pending, operation.id);
  assert.equal(confirmed.phase, "confirmed");
  assert.equal(confirmed.result, "confirmed");
});

test("teacher board mutation failures distinguish retryable and terminal rollback results", () => {
  const operation = createTeacherBoardOperation("move", "card-a", 4, 1);
  const pending = startTeacherBoardMutation(idleTeacherBoardMutationState(), operation);
  assert.equal(failTeacherBoardMutation(pending, operation.id, false).phase, "retryable-error");
  assert.equal(failTeacherBoardMutation(pending, operation.id, true).phase, "terminal-error");
});

test("teacher board reconciliation and stale responses preserve the active operation", () => {
  const operation = createTeacherBoardOperation("visibility", "card-a", 4, 1);
  const pending = startTeacherBoardMutation(idleTeacherBoardMutationState(), operation);
  const stale = rejectStaleTeacherBoardResponse(pending, "visibility:card-a:4:0");
  assert.equal(stale.phase, "pending");
  assert.equal(stale.staleResponsesIgnored, 1);
  assert.equal(reconcileTeacherBoardMutation(pending, operation.id).phase, "reconciling");
});

test("teacher board version comparison accepts newer snapshots and ignores older snapshots", () => {
  assert.equal(isNewerTeacherBoardVersion(5, 4), true);
  assert.equal(isStaleTeacherBoardVersion(3, 4), true);
  assert.equal(isStaleTeacherBoardVersion(4, 4), false);
});
