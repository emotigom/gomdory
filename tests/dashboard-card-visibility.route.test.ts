import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { POST as updateVisibility } from "@/app/api/v1/dashboard/cards/[cardId]/visibility/route";
import { setCardHiddenForAuthorizedBoard } from "@/lib/data/cards";

type VisibilityPayload = {
  ok?: boolean;
  error?: string;
  card?: {
    id: string;
    wallId: string;
    position: number | null;
    isHidden: boolean;
    hiddenAt: string | null;
  };
};

function requestWithBody(body: unknown) {
  return new Request("http://localhost/api/v1/dashboard/cards/card-1/visibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeDeps(options: {
  userId?: string;
  boardOwnerId?: string | null;
  role?: "owner" | "editor" | "viewer" | null;
  cardOwnerId?: string | null;
  cardFound?: boolean;
  updatedHidden?: boolean;
  hiddenAt?: string | null;
  position?: number | null;
  onUpdate?: (input: { cardId: string; hidden: boolean }) => void;
}) {
  return {
    requireUserFn: async () => {
      if (!options.userId) throw new Error("unauthenticated");
      return { user: { id: options.userId } };
    },
    createSupabaseAdminClientFn: () =>
      ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          assert.equal(name, "board_role");
          assert.deepEqual(args, { bid: "board-1" });
          return { data: options.role ?? null, error: null };
        },
      }) as never,
    loadCardForUploadFn: async () =>
      options.cardFound === false
        ? null
        : {
            id: "card-1",
            boardId: "board-1",
            wallId: "wall-1",
            cardOwnerId: options.cardOwnerId ?? "student-user",
            boardOwnerId: options.boardOwnerId ?? "teacher-owner",
          },
    setCardHiddenForAuthorizedBoardFn: async (input: { cardId: string; hidden: boolean }) => {
      options.onUpdate?.(input);
      return {
        id: input.cardId,
        wall_id: "wall-1",
        position: options.position ?? 7,
        is_hidden: options.updatedHidden ?? input.hidden,
        hidden_at: options.hiddenAt ?? (input.hidden ? "2026-07-06T00:00:00.000Z" : null),
      };
    },
    shouldBumpActivityFn: () => false,
  };
}

test("board owner can hide own-board teacher and student or anonymous cards", async () => {
  const updates: Array<{ cardId: string; hidden: boolean; cardOwnerId: string | null }> = [];

  for (const cardOwnerId of ["teacher-owner", "student-user", null]) {
    const response = await updateVisibility(
      requestWithBody({ hidden: true }),
      { params: Promise.resolve({ cardId: "card-1" }) },
      routeDeps({
        userId: "teacher-owner",
        boardOwnerId: "teacher-owner",
        cardOwnerId,
        onUpdate: (input) => updates.push({ cardId: input.cardId, hidden: input.hidden, cardOwnerId }),
      }),
    );
    const payload = (await response.json()) as VisibilityPayload;

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.card?.isHidden, true);
    assert.equal(payload.card?.wallId, "wall-1");
    assert.equal(payload.card?.position, 7);
  }

  assert.deepEqual(updates, [
    { cardId: "card-1", hidden: true, cardOwnerId: "teacher-owner" },
    { cardId: "card-1", hidden: true, cardOwnerId: "student-user" },
    { cardId: "card-1", hidden: true, cardOwnerId: null },
  ]);
});

test("board editor can hide cards through board_role", async () => {
  let updated = false;
  const response = await updateVisibility(
    requestWithBody({ hidden: true }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      userId: "editor-user",
      boardOwnerId: "teacher-owner",
      role: "editor",
      onUpdate: () => {
        updated = true;
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(updated, true);
});

test("board owner can reveal hidden cards and hiddenAt returns null", async () => {
  const response = await updateVisibility(
    requestWithBody({ hidden: false }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      userId: "teacher-owner",
      boardOwnerId: "teacher-owner",
      updatedHidden: false,
      hiddenAt: null,
      position: 3,
    }),
  );
  const payload = (await response.json()) as VisibilityPayload;

  assert.equal(response.status, 200);
  assert.equal(payload.card?.isHidden, false);
  assert.equal(payload.card?.hiddenAt, null);
  assert.equal(payload.card?.position, 3);
});

test("unauthorized logged-in users and anonymous users cannot change visibility", async () => {
  let updateCount = 0;
  const forbiddenResponse = await updateVisibility(
    requestWithBody({ hidden: true }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      userId: "viewer-user",
      boardOwnerId: "teacher-owner",
      role: "viewer",
      onUpdate: () => {
        updateCount += 1;
      },
    }),
  );
  const anonymousResponse = await updateVisibility(
    requestWithBody({ hidden: true }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      onUpdate: () => {
        updateCount += 1;
      },
    }),
  );

  assert.equal(forbiddenResponse.status, 403);
  assert.equal(anonymousResponse.status, 401);
  assert.equal(updateCount, 0);
});

test("invalid hidden payload and missing cards fail safely", async () => {
  let updateCount = 0;
  const invalidResponse = await updateVisibility(
    requestWithBody({ hidden: "true" }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      userId: "teacher-owner",
      boardOwnerId: "teacher-owner",
      onUpdate: () => {
        updateCount += 1;
      },
    }),
  );
  const notFoundResponse = await updateVisibility(
    requestWithBody({ hidden: true }),
    { params: Promise.resolve({ cardId: "card-1" }) },
    routeDeps({
      userId: "teacher-owner",
      cardFound: false,
      onUpdate: () => {
        updateCount += 1;
      },
    }),
  );

  assert.equal(invalidResponse.status, 400);
  assert.equal(notFoundResponse.status, 404);
  assert.equal(updateCount, 0);
});

test("setCardHiddenForAuthorizedBoard only updates visibility timestamps and preserves position", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const filters: Array<[string, unknown]> = [];
  const deletedFilters: Array<[string, unknown]> = [];
  const selects: string[] = [];

  const supabase = {
    from: (table: string) => {
      assert.equal(table, "cards");
      return {
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            eq: (column: string, value: unknown) => {
              filters.push([column, value]);
              return {
                is: (isColumn: string, isValue: unknown) => {
                  deletedFilters.push([isColumn, isValue]);
                  return {
                    select: (fields: string) => {
                      selects.push(fields);
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: "card-1",
                            wall_id: "wall-1",
                            position: 12,
                            is_hidden: payload.is_hidden,
                            hidden_at: payload.hidden_at,
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const hidden = await setCardHiddenForAuthorizedBoard({ supabase: supabase as never, cardId: "card-1", hidden: true });
  const revealed = await setCardHiddenForAuthorizedBoard({ supabase: supabase as never, cardId: "card-1", hidden: false });

  assert.equal(hidden.position, 12);
  assert.equal(hidden.is_hidden, true);
  assert.equal(typeof hidden.hidden_at, "string");
  assert.equal(revealed.position, 12);
  assert.equal(revealed.is_hidden, false);
  assert.equal(revealed.hidden_at, null);
  assert.deepEqual(filters, [["id", "card-1"], ["id", "card-1"]]);
  assert.deepEqual(deletedFilters, [["deleted_at", null], ["deleted_at", null]]);
  assert.deepEqual(selects, [
    "id, wall_id, position, is_hidden, hidden_at",
    "id, wall_id, position, is_hidden, hidden_at",
  ]);

  for (const payload of updates) {
    assert.deepEqual(Object.keys(payload).sort(), ["hidden_at", "is_hidden", "updated_at"]);
    assert.equal("wall_id" in payload, false);
    assert.equal("position" in payload, false);
    assert.equal("card_color_token" in payload, false);
    assert.equal("external_attachments" in payload, false);
    assert.equal("text" in payload, false);
  }
});

test("share and teacher board card contracts keep hidden filtering separated", () => {
  const shareSource = fs.readFileSync(path.join(process.cwd(), "lib/data/share.ts"), "utf8");
  const teacherPageSource = fs.readFileSync(
    path.join(process.cwd(), "app/dashboard/boards/[boardId]/board/page.tsx"),
    "utf8",
  );
  const teacherClientSource = fs.readFileSync(
    path.join(process.cwd(), "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx"),
    "utf8",
  );

  assert.match(shareSource, /listCardsForShare[\s\S]*\.eq\("is_hidden", false\)/);
  assert.match(shareSource, /listCardsForSharePaged[\s\S]*includeHidden: false/);
  assert.match(shareSource, /listWallCardsPaginatedForShare[\s\S]*includeHidden: false/);
  assert.match(shareSource, /countCardsForShare[\s\S]*\.eq\("is_hidden", false\)/);
  assert.match(teacherPageSource, /listWallCardsPaginated\(\{[\s\S]*includeHidden: true/);
  assert.match(teacherClientSource, /is_hidden\?: boolean \| null/);
  assert.match(teacherClientSource, /hidden_at\?: string \| null/);
});
