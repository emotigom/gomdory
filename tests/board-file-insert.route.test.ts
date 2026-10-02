import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as insertPost } from "@/app/api/v1/boards/[boardId]/files/insert/route";

test("board file insert API requires board membership", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/v1/boards/board-1/files/insert", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ fileId: "file-1" }),
    }),
  );

  const response = await insertPost(
    request,
    { params: Promise.resolve({ boardId: "board-1" }) },
    {
      requireUserApiFn: async () => ({
        user: { id: "user-1", app_metadata: {}, user_metadata: {} },
      }),
      createSupabaseClientFn: () =>
        ({
          rpc: async () => ({ data: null, error: null }),
        }) as any,
    },
  );

  assert.equal(response.status, 403);
});
