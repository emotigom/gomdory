import assert from "node:assert/strict";
import test from "node:test";

import { buildFilesInsertPayload } from "@/lib/files/buildFilesInsertPayload";

test("buildFilesInsertPayload sets both owner columns for schema compatibility", () => {
  const ownerId = "user-123";
  const insert = buildFilesInsertPayload({
    ownerId,
    boardId: "board-1",
    r2Key: "r2://bucket/key",
    originalName: "lesson.png",
    contentType: "image/png",
    optimizedBytes: 100,
    originalBytes: 120,
    sha256: null,
    tags: ["edu"],
  });

  assert.equal(insert.owner_id, ownerId);
  assert.equal(insert.owner_user_id, ownerId);
});
