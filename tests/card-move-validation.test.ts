import assert from "node:assert/strict";
import test from "node:test";

import { isValidCardMoveBoundary } from "@/lib/board/cardMoveValidation";

test("isValidCardMoveBoundary returns true only when card and target wall belong to requested board", () => {
  assert.equal(
    isValidCardMoveBoundary({
      requestedBoardId: "board-1",
      cardBoardId: "board-1",
      targetWallBoardId: "board-1",
    }),
    true,
  );

  assert.equal(
    isValidCardMoveBoundary({
      requestedBoardId: "board-1",
      cardBoardId: "board-2",
      targetWallBoardId: "board-1",
    }),
    false,
  );

  assert.equal(
    isValidCardMoveBoundary({
      requestedBoardId: "board-1",
      cardBoardId: "board-1",
      targetWallBoardId: "board-2",
    }),
    false,
  );

  assert.equal(
    isValidCardMoveBoundary({
      requestedBoardId: "",
      cardBoardId: "board-1",
      targetWallBoardId: "board-1",
    }),
    false,
  );
});
