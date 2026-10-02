import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as filesGet } from "@/app/api/v1/files/route";

test("files list API accepts limit query", async () => {
  const response = await filesGet(
    new NextRequest(new Request("http://localhost/api/v1/files?limit=12")),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      listBoardFileLibraryFn: async ({ limit }) => {
        assert.equal(limit, 12);
        return { items: [], nextCursor: null };
      },
    },
  );

  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});
