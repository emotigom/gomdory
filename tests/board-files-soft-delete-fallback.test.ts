import assert from "node:assert/strict";
import test from "node:test";

import { shouldRetryBoardFileSoftDeleteWithMinimalPayload } from "@/lib/data/boardFiles";

test("soft delete fallback retry token detection is conditional", () => {
  assert.equal(
    shouldRetryBoardFileSoftDeleteWithMinimalPayload("PostgREST schema cache does not include column deleted_by"),
    true,
  );
  assert.equal(
    shouldRetryBoardFileSoftDeleteWithMinimalPayload('Could not find the \"deleted_by\" column of \"board_files\" in the schema cache'),
    true,
  );
  assert.equal(shouldRetryBoardFileSoftDeleteWithMinimalPayload("duplicate key value violates unique constraint"), false);
});
