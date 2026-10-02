import assert from "node:assert/strict";
import test from "node:test";

import { PATCH as moveShareCard } from "@/app/api/v1/share/[code]/cards/[cardId]/move/route";

test("share card move returns 403 when clientId mismatches card authorClientId", async () => {
  let updateCalled = false;
  const request = new Request("http://localhost/api/v1/share/abc123/cards/card-1/move", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-request-id": "req-share-move-001" },
    body: JSON.stringify({
      clientId: "client-A",
      wallId: "wall-2",
      clientMutationId: "mutation-1",
    }),
  });

  const response = await moveShareCard(
    request,
    { params: Promise.resolve({ code: "abc123", cardId: "card-1" }) },
    {
      getBoardByShareCodeFn: async () => ({
        id: "board-1",
        class_state: "active",
        share_write_enabled: true,
      }) as never,
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "walls") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: "wall-2", boardId: "board-1" }, error: null }),
                  }),
                }),
              };
            }

            if (table === "cards") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: "card-1",
                          authorClientId: "client-B",
                          authorType: "student",
                          wallId: "wall-1",
                          walls: { boardId: "board-1" },
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
                update: () => {
                  updateCalled = true;
                  throw new Error("update should not be called for unauthorized moves");
                },
              };
            }

            throw new Error(`unexpected table access: ${table}`);
          },
        }) as never,
    },
  );

  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(payload.error?.code, "FORBIDDEN");
  assert.equal(updateCalled, false);
});

test("share card move accepts position and persists normalized card order", async () => {
  const updatedRows: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const request = new Request("http://localhost/api/v1/share/abc123/cards/card-1/move", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-request-id": "req-share-move-002" },
    body: JSON.stringify({
      clientId: "client-A",
      wallId: "wall-2",
      position: 3,
      clientMutationId: "mutation-2",
    }),
  });

  const response = await moveShareCard(
    request,
    { params: Promise.resolve({ code: "abc123", cardId: "card-1" }) },
    {
      getBoardByShareCodeFn: async () => ({
        id: "board-1",
        class_state: "active",
        share_write_enabled: true,
      }) as never,
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "walls") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: "wall-2", boardId: "board-1" }, error: null }),
                  }),
                }),
              };
            }
            if (table === "cards") {
              return {
                select: (fields: string) => {
                  if (fields === "id, wall_id, position, created_at") {
                    return {
                      in: () => ({
                        is: async () => ({
                          data: [
                            { id: "card-1", wall_id: "wall-1", position: 0, created_at: "2026-01-01T00:00:00.000Z" },
                            { id: "card-2", wall_id: "wall-1", position: 1, created_at: "2026-01-01T00:00:01.000Z" },
                            { id: "card-3", wall_id: "wall-2", position: 0, created_at: "2026-01-01T00:00:02.000Z" },
                          ],
                          error: null,
                        }),
                      }),
                    };
                  }
                  return {
                    eq: () => ({
                      is: () => ({
                        maybeSingle: async () => ({
                          data: {
                            id: "card-1",
                            authorClientId: "client-A",
                            authorType: "student",
                            wallId: "wall-1",
                            walls: { boardId: "board-1" },
                          },
                          error: null,
                        }),
                      }),
                    }),
                  };
                },
                update: (payload: Record<string, unknown>) => {
                  return {
                    eq: (column: string, id: string) => ({
                      is: () => ({
                        select: async () => {
                          assert.equal(column, "id");
                          updatedRows.push({ id, payload });
                          return { data: [{ id }], error: null };
                        },
                      }),
                    }),
                  };
                },
              };
            }
            if (table === "card_move_mutations") {
              return {
                insert: () => ({
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: "cm-1" }, error: null }),
                  }),
                }),
              };
            }
            throw new Error(`unexpected table access: ${table}`);
          },
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(updatedRows.map((row) => [row.id, row.payload.wall_id, row.payload.position]), [
    ["card-2", "wall-1", 0],
    ["card-3", "wall-2", 0],
    ["card-1", "wall-2", 1],
  ]);
});
