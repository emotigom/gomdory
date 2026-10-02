import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as filesGet } from "@/app/api/v1/files/route";
import { PATCH as filesPatch } from "@/app/api/v1/files/[fileId]/route";

test("files API lists items with cursor pagination", async () => {
  const calls: Array<{ cursor?: string | null; sort?: string }> = [];

  const response = await filesGet(
    new NextRequest(new Request("http://localhost/api/v1/files?cursor=next&sort=recent&limit=2")),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      listBoardFileLibraryFn: async (input) => {
        calls.push({ cursor: input.cursor, sort: input.sort });
        return { items: [], nextCursor: "next-page" };
      },
    },
  );

  const body = (await response.json()) as { ok?: boolean; nextCursor?: string | null };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.nextCursor, "next-page");
  assert.equal(calls[0]?.cursor, "next");
  assert.equal(calls[0]?.sort, "recent");
});

test("files API updates tags", async () => {
  const response = await filesPatch(
    new Request("http://localhost/api/v1/files/file-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["math", "lesson"] }),
    }),
    { params: Promise.resolve({ fileId: "file-1" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      updateBoardFileMetadataFn: async (input) => {
        assert.equal(input.fileId, "file-1");
        assert.deepEqual(input.tags, ["math", "lesson"]);
        return {
          id: input.fileId,
          owner_id: input.ownerId,
          board_id: "board-1",
          r2_key: "r2-key",
          filename: "demo.png",
          bytes: 1200,
          mime: "image/png",
          width: 120,
          height: 80,
          created_at: new Date().toISOString(),
          tags: input.tags ?? [],
          is_favorite: false,
          last_used_at: null,
          deleted_at: null,
          hash_sha256: null,
          variant: "optimized",
          original_bytes: null,
          optimized_bytes: null,
          bytes_saved: null,
        };
      },
    },
  );

  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});
