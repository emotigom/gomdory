import assert from "node:assert/strict";
import test from "node:test";

import { getCreateBoardSuccessDetail } from "@/app/dashboard/createBoardSuccess";
import type { CreateBoardState } from "@/app/dashboard/actions";

test("getCreateBoardSuccessDetail returns null when create is not successful", () => {
  const state: CreateBoardState = { success: false };
  assert.equal(getCreateBoardSuccessDetail(state), null);
});

test("getCreateBoardSuccessDetail returns normalized detail when success has board id", () => {
  const state: CreateBoardState = {
    success: true,
    board: {
      boardId: "  board-123  ",
      title: "  새 보드  ",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };

  assert.deepEqual(getCreateBoardSuccessDetail(state), {
    boardId: "board-123",
    title: "새 보드",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
});

test("getCreateBoardSuccessDetail returns null when board id is missing", () => {
  const state: CreateBoardState = {
    success: true,
    board: {
      boardId: " ",
      title: "제목",
    },
  };

  assert.equal(getCreateBoardSuccessDetail(state), null);
});
