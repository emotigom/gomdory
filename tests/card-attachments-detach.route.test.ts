import assert from "node:assert/strict";
import test from "node:test";

import { DELETE as detachDelete } from "@/app/api/v1/cards/[cardId]/attachments/[boardFileId]/route";

test("card attachment detach route rejects unauthenticated request", async () => {
  const response = await detachDelete(
    new Request("http://localhost/api/v1/cards/card-1/attachments/file-1", { method: "DELETE" }),
    { params: Promise.resolve({ cardId: "card-1", boardFileId: "file-1" }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      createSupabaseClientFn: () => ({} as any),
    },
  );

  assert.equal(response.status, 401);
});

test("card attachment detach route unlinks card_files row when authorized", async () => {
  let deleted = false;
  let deleteCardId = "";
  let deleteBoardFileId = "";

  const response = await detachDelete(
    new Request("http://localhost/api/v1/cards/card-1/attachments/file-1", { method: "DELETE" }),
    { params: Promise.resolve({ cardId: "card-1", boardFileId: "file-1" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      createSupabaseClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "cards") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: "card-1",
                          wallId: "wall-1",
                          walls: { boardId: "board-1" },
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }

            if (table === "board_files") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: { id: "file-1", owner_id: "user-1" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }

            if (table === "card_files") {
              return {
                delete: () => ({
                  match: async (values: Record<string, string>) => {
                    deleted = true;
                    deleteCardId = values.card_id ?? "";
                    deleteBoardFileId = values.board_file_id ?? "";
                    return { error: null };
                  },
                }),
              };
            }

            return {} as any;
          },
          rpc: async () => ({ data: "owner", error: null }),
        }) as any,
    },
  );

  const body = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(deleted, true);
  assert.equal(deleteCardId, "card-1");
  assert.equal(deleteBoardFileId, "file-1");
});

test("card attachment detach route rejects viewers before deleting", async () => {
  const response = await detachDelete(
    new Request("http://localhost/api/v1/cards/card-1/attachments/file-1", { method: "DELETE" }),
    { params: Promise.resolve({ cardId: "card-1", boardFileId: "file-1" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
      createSupabaseClientFn: () =>
        ({
          from: () => ({
            select: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({
                    data: { id: "card-1", wallId: "wall-1", walls: { boardId: "board-1" } },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          rpc: async () => ({ data: "viewer", error: null }),
        }) as any,
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: "forbidden" });
});
