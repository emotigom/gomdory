import assert from "node:assert/strict";
import test from "node:test";

import { POST as preparePost } from "@/app/api/v1/files/upload/prepare/route";
import { makeMockUser } from "@/tests/helpers/mockUser";

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
            return {
              data: {
                id: "file-1",
                board_id: "board-1",
                owner_id: "user-1",
                r2_key: "u/user-1/o/file",
                filename: "demo.png",
                bytes: 1234,
                mime: "image/png",
                width: 10,
                height: 10,
                created_at: new Date().toISOString(),
                tags: [],
                is_favorite: false,
                last_used_at: null,
                deleted_at: null,
                hash_sha256: "a".repeat(64),
                variant: "optimized",
                original_bytes: 1234,
                optimized_bytes: 1234,
                bytes_saved: 0,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

test("upload prepare returns deduped when sha256 exists", async () => {
  const response = await preparePost(
    new Request("http://localhost/api/v1/files/upload/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: "board-1",
        filename: "demo.png",
        contentType: "image/png",
        sizeBytes: 1234,
        sha256: "a".repeat(64),
      }),
    }) as unknown as Parameters<typeof preparePost>[0],
    undefined,
    {
      requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-1" }) }),
      createSupabaseServerClientFn: () => createSupabaseStub() as never,
      presignPutUrlFn: async () => "https://example.com/upload",
    },
  );

  const body = (await response.json()) as {
    ok?: boolean;
    deduped?: boolean;
    existingFile?: { id?: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.deduped, true);
  assert.equal(body.existingFile?.id, "file-1");
});
