import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as attachPost } from "@/app/api/v1/boards/[boardId]/files/attach/route";

test("file attach API returns ok with attachment reference", async () => {
  const request = new NextRequest(
    new Request("http://localhost/api/v1/boards/board-1/files/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ fileId: "file-1" }),
    }),
  );

  const response = await attachPost(
    request,
    { params: Promise.resolve({ boardId: "board-1" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      createSupabaseClientFn: () =>
        ({
          rpc: async () => ({ data: "owner", error: null }),
          from: (table: string) => {
            if (table === "board_files") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      single: async () => ({
                        data: {
                          id: "file-1",
                          r2_key: "r2-key",
                          filename: "demo.png",
                          mime: "image/png",
                          bytes: 1200,
                          owner_id: "user-1",
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }
            if (table === "walls") {
              return {
                select: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        eq: () => ({
                          single: async () => ({ data: { id: "wall-1" }, error: null }),
                        }),
                        single: async () => ({ data: { id: "wall-1" }, error: null }),
                      }),
                    }),
                  }),
                }),
              };
            }
            return {} as any;
          },
        }) as any,
      createCardFn: async () => ({ id: "card-1" }) as any,
      touchBoardFileFn: async () => undefined,
      attachBoardFileToCardFn: async () => undefined,
    },
  );

  const body = (await response.json()) as { ok?: boolean; attached?: { cardId?: string } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.attached?.cardId, "card-1");
});
