import assert from "node:assert/strict";
import test from "node:test";

import { POST as dedupCheckPost } from "@/app/api/v1/files/dedup-check/route";

test("dedup-check returns existing match for owner and sha256", async () => {
  const calls: Array<{ ownerId: string; sha256: string }> = [];
  const sha = "a".repeat(64);

  const response = await dedupCheckPost(
    new Request("http://localhost/api/v1/files/dedup-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha256: sha, sizeBytes: 1024, mime: "image/png" }),
    }),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      findBoardFileByHashFn: async (input) => {
        calls.push({ ownerId: input.ownerId, sha256: input.sha256 });
        return {
          id: "file-1",
          owner_id: input.ownerId,
          board_id: "board-1",
          r2_key: "r2/demo.png",
          filename: "demo.png",
          bytes: 1200,
          mime: "image/png",
          width: 100,
          height: 80,
          created_at: "2024-01-01T00:00:00.000Z",
          tags: [],
          is_favorite: false,
          last_used_at: null,
          deleted_at: null,
          hash_sha256: input.sha256,
          variant: "optimized",
          original_bytes: null,
          optimized_bytes: null,
          bytes_saved: null,
        };
      },
    },
  );

  const body = (await response.json()) as { ok?: boolean; exists?: boolean; file?: { id: string } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.exists, true);
  assert.equal(body.file?.id, "file-1");
  assert.equal(calls[0]?.ownerId, "user-1");
  assert.equal(calls[0]?.sha256, sha);
});
