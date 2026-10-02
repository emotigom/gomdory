import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as demoPost } from "@/app/api/v1/onboarding/demo/route";

const now = new Date("2025-01-01T00:00:00.000Z");

function createDeps() {
  const boards: Array<{ id: string; owner_id: string; title: string; created_at: string; share_code: string | null }> =
    [];
  const userId = "user-1";

  const deps = {
    validateEnvFn: () => ({ ok: true }),
    requireUserApiFn: async () => ({ user: { id: userId } }),
    createBoardFn: async ({
      title,
    }: {
      title: string;
      description?: string | null;
      boardViewType?: string | null;
      classId?: string | null;
    }) => {
      const board = {
        id: `board-${boards.length + 1}`,
        owner_id: userId,
        title,
        created_at: now.toISOString(),
        description: null,
        board_view_type: "grid" as const,
        share_code: null,
        share_enabled: false,
        share_updated_at: now.toISOString(),
        share_write_enabled: false,
        share_write_updated_at: now.toISOString(),
        class_state: "idle" as const,
        class_notice: null,
        class_updated_at: now.toISOString(),
        rules_text: null,
        rules_updated_at: now.toISOString(),
      };
      boards.push(board);
      return board;
    },
    createWallFn: async ({ boardId, title }: { boardId: string; title: string; description?: string | null }) => ({
      id: `wall-${boardId}`,
      board_id: boardId,
      title: title ?? "demo",
      description: null,
      created_at: now.toISOString(),
      position: 1,
    }),
    createCardFn: async ({
      wallId,
      text,
      boardId,
    }: {
      wallId: string;
      text: string;
      boardId?: string;
      externalAttachments?: unknown;
    }) => ({
      id: `card-${wallId}-${text.slice(0, 4)}`,
      wall_id: wallId,
      board_id: boardId,
      author_type: "teacher" as const,
      author_name: "demo",
      text,
      created_at: now.toISOString(),
      is_hidden: false,
      hidden_at: null,
      is_pinned: false,
      pinned_at: null,
      is_featured: false,
      featured_at: null,
      card_color_token: null,
      external_attachments: [],
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    }),
    enableSharingFn: async (boardId: string) => {
      const match = boards.find((board) => board.id === boardId);
      if (match) {
        match.share_code = match.share_code ?? "share01";
      }
      return {
        id: boardId,
        owner_id: userId,
        title: "demo",
        description: null,
        board_view_type: "grid" as const,
        share_code: match?.share_code ?? "share01",
        share_enabled: true,
        share_updated_at: now.toISOString(),
        share_write_enabled: true,
        share_write_updated_at: now.toISOString(),
        class_state: "idle" as const,
        class_notice: null,
        class_updated_at: now.toISOString(),
        rules_text: null,
        rules_updated_at: now.toISOString(),
      };
    },
    createSupabaseServerClientFn: () => ({
      from: () => {
        const filters: Record<string, string> = {};
        let since = now.toISOString();
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              filters[field] = value;
              return {
                eq: (field2: string, value2: string) => {
                  filters[field2] = value2;
                  return {
                    gte: (_field: string, gteValue: string) => {
                      since = gteValue;
                      return {
                        order: () => ({
                          limit: () => ({
                            maybeSingle: async () => {
                              const found = boards
                                .filter(
                                  (board) =>
                                    (!filters.owner_id || board.owner_id === filters.owner_id) &&
                                    (!filters.title || board.title === filters.title) &&
                                    board.created_at >= since,
                                )
                                .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
                              return { data: found ?? null, error: null };
                            },
                          }),
                        }),
                      };
                    },
                  };
                },
              };
            },
          }),
        };
      },
    }),
    startSessionFn: async ({
      boardId,
      shareCode,
    }: {
      boardId: string;
      shareCode?: string | null;
      title?: string | null;
      createdBy?: string | null;
      classId?: string | null;
      sectionId?: string | null;
    }) => ({
      id: `session-${boardId}`,
      board_id: boardId,
      share_code: shareCode ?? "share01",
      title: "demo",
      started_at: now.toISOString(),
      ended_at: null,
      created_by: userId,
      report: null,
      status: "running" as const,
    }),
    upsertBoardLiveSessionFn: async () => ({}),
    now: () => now,
  };

  return { deps, boards };
}

test("demo onboarding route is idempotent for 24h", async () => {
  const { deps, boards } = createDeps();
  const request = new NextRequest(new Request("http://localhost/api/v1/onboarding/demo", { method: "POST" }));

  const first = await demoPost(request, undefined, deps as never);
  const payload1 = (await first.json()) as { ok: boolean; boardId: string; shareCode: string; studentUrl: string };

  assert.equal(payload1.ok, true);
  assert.equal(payload1.shareCode, "share01");
  assert.match(payload1.studentUrl, /gkrry\.com/);
  assert.ok(boards.find((board) => board.id === payload1.boardId));

  const second = await demoPost(request, undefined, deps as never);
  const payload2 = (await second.json()) as { ok: boolean; boardId: string; shareCode: string };

  assert.equal(payload2.ok, true);
  assert.equal(payload2.boardId, payload1.boardId);
  assert.equal(payload2.shareCode, "share01");
  assert.equal(boards.length, 1);
});
