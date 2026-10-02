import assert from "node:assert/strict";
import test from "node:test";

import { buildBulkActionSuccessMessage } from "@/app/dashboard/boards/[boardId]/class/bulkCardActions";

test("buildBulkActionSuccessMessage returns move summary", () => {
  assert.equal(buildBulkActionSuccessMessage("move", 3), "3개 카드를 이동했어요.");
});

test("buildBulkActionSuccessMessage returns delete summary", () => {
  assert.equal(buildBulkActionSuccessMessage("delete", 2), "2개 카드를 휴지통으로 이동했어요.");
});
