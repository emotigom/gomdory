import assert from "node:assert/strict";
import test from "node:test";

import { isSameCardMoveMutation } from "@/lib/board/cardMoveMutation";

test("API mutationId duplicate payload is treated as same mutation", () => {
  const first = { boardId: "b1", cardId: "c1", targetWallId: "w2" };
  const duplicate = { boardId: "b1", cardId: "c1", targetWallId: "w2" };

  assert.equal(isSameCardMoveMutation(first, duplicate), true);
});

test("API mutationId reuse with different payload is rejected", () => {
  const first = { boardId: "b1", cardId: "c1", targetWallId: "w2" };
  const conflicting = { boardId: "b1", cardId: "c1", targetWallId: "w3" };

  assert.equal(isSameCardMoveMutation(first, conflicting), false);
});
