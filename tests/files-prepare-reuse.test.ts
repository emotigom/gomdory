import assert from "node:assert/strict";
import test from "node:test";

import { POST as preparePost } from "@/app/api/v1/files/prepare/route";

function createSupabaseStub() {
  return {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "boards") {
            return { data: { id: "board-1", owner_id: "user-1" }, error: null };
          }
          if (table === "board_files") {
            return { data: { id: "file-1", r2_key: "u/user-1/o/hash", bytes: 1234 }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

test("files prepare returns reuse when hash exists", async () => {
  const response = await preparePost(
    new Request("http://localhost/api/v1/files/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: "board-1",
        filename: "demo.png",
        mime: "image/png",
        bytesOriginal: 2048,
        bytesStored: 2048,
        contentHash: "a".repeat(64),
        optimized: false,
      }),
    }),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      createSupabaseServerClientFn: () => createSupabaseStub() as never,
      presignPutUrlFn: async () => "https://example.com/upload",
    },
  );

  const body = (await response.json()) as {
    ok?: boolean;
    reuse?: boolean;
    existing?: { objectKey: string; bytesStored: number };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.reuse, true);
  assert.equal(body.existing?.objectKey, "u/user-1/o/hash");
  assert.equal(body.existing?.bytesStored, 1234);
});
