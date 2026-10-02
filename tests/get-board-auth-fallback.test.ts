import assert from "node:assert/strict";
import test from "node:test";

import { getBoard } from "@/lib/data/boards.server";

type BoardFixture = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  created_at: string;
  board_view_type: "grid" | "wall" | "mindmap" | "gen";
  share_code: string | null;
  share_enabled: boolean;
  share_updated_at: string;
  share_write_enabled: boolean;
  share_write_updated_at: string;
  class_state: "idle" | "live" | "ended";
  class_notice: string | null;
  class_updated_at: string;
  rules_text: string | null;
  rules_updated_at: string;
  tools_enabled: string[];
  tools_updated_at: string;
  ui_minimap_mode: "hover" | "toggle" | "always" | "hidden" | null;
  ui_minimap_updated_at: string | null;
  ui_wallpaper_key: string | null;
  ui_wallpaper_updated_at: string | null;
};

function makeBoardClient({
  board,
  primaryBoardError,
  primaryBoardNull = false,
  memberRole = null,
}: {
  board: BoardFixture | null;
  primaryBoardError?: { message: string; code?: string; status?: number } | null;
  primaryBoardNull?: boolean;
  memberRole?: string | null;
}) {
  return {
    from(table: string) {
      const filters = new Map<string, unknown>();

      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          filters.set(column, value);
          return this;
        },
        is() {
          return this;
        },
        maybeSingle: async <T,>() => {
          if (table === "boards") {
            if (primaryBoardError) {
              return { data: null, error: primaryBoardError };
            }

            if (primaryBoardNull || !board || filters.get("id") !== board.id) {
              return { data: null, error: null };
            }

            if (filters.get("id") === board.id) {
              return { data: board as T, error: null };
            }
          }

          if (table === "board_members") {
            const boardId = filters.get("board_id");
            if (!board || boardId !== board.id || !memberRole) {
              return { data: null, error: null };
            }

            return { data: { role: memberRole } as T, error: null };
          }

          return { data: null, error: null };
        },
      };
    },
  };
}

const boardFixture: BoardFixture = {
  id: "board-1",
  owner_id: "user-1",
  title: "Fallback board",
  description: "Restored via admin fallback",
  created_at: "2026-03-18T00:00:00.000Z",
  board_view_type: "wall",
  share_code: "abc234",
  share_enabled: true,
  share_updated_at: "2026-03-18T00:00:00.000Z",
  share_write_enabled: true,
  share_write_updated_at: "2026-03-18T00:00:00.000Z",
  class_state: "idle",
  class_notice: null,
  class_updated_at: "2026-03-18T00:00:00.000Z",
  rules_text: null,
  rules_updated_at: "2026-03-18T00:00:00.000Z",
  tools_enabled: [],
  tools_updated_at: "2026-03-18T00:00:00.000Z",
  ui_minimap_mode: "hover",
  ui_minimap_updated_at: "2026-03-18T00:00:00.000Z",
  ui_wallpaper_key: "wallpaper-1",
  ui_wallpaper_updated_at: "2026-03-18T00:00:00.000Z",
};

test("getBoard falls back to an admin-verified owner lookup when the session query returns empty", async () => {
  const result = await getBoard("board-1", {
    userId: "user-1",
    supabase: makeBoardClient({ board: boardFixture, primaryBoardNull: true }) as never,
    createSupabaseAdminClientFn: () => makeBoardClient({ board: boardFixture }) as never,
  });

  assert.equal(result.board?.id, "board-1");
  assert.equal(result.board?.title, "Fallback board");
  assert.equal(result.board?.ui_wallpaper_key, "wallpaper-1");
});

test("getBoard falls back for an authenticated board member when the primary lookup returns 403", async () => {
  const memberBoard = { ...boardFixture, owner_id: "teacher-1" };

  const result = await getBoard("board-1", {
    userId: "editor-1",
    supabase: makeBoardClient({
      board: memberBoard,
      primaryBoardError: { message: "permission denied", code: "42501", status: 403 },
    }) as never,
    createSupabaseAdminClientFn: () =>
      makeBoardClient({
        board: memberBoard,
        memberRole: "editor",
      }) as never,
  });

  assert.equal(result.board?.id, "board-1");
  assert.equal(result.board?.title, "Fallback board");
});

test("getBoard does not expose boards to authenticated users without owner/member access", async () => {
  const result = await getBoard("board-1", {
    userId: "user-2",
    supabase: makeBoardClient({ board: boardFixture, primaryBoardNull: true }) as never,
    createSupabaseAdminClientFn: () => makeBoardClient({ board: boardFixture }) as never,
  });

  assert.equal(result.board, null);
});
