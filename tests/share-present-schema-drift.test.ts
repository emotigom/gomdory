import assert from "node:assert/strict";
import test from "node:test";

import { getBoardByShareCode } from "@/lib/data/share";

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
};

function createAdminClientStub(results: QueryResult[], selected: string[]) {
  let callIndex = 0;
  return {
    from: () => ({
      select: (columns: string) => {
        selected.push(columns);
        return {
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => {
                  const result = results[callIndex] ?? results.at(-1) ?? { data: null, error: null };
                  callIndex += 1;
                  return result;
                },
              }),
            }),
          }),
        };
      },
    }),
  };
}

test("getBoardByShareCode returns board when ui_wallpaper_key exists", async () => {
  const selected: string[] = [];
  const admin = createAdminClientStub(
    [
      {
        data: {
          id: "board-1",
          owner_id: "teacher-1",
          title: "board",
          board_view_type: "wall",
          wall_v2_enabled: false,
          share_code: "abc234",
          share_enabled: true,
          share_updated_at: "2024-01-01T00:00:00.000Z",
          share_write_enabled: true,
          share_write_updated_at: "2024-01-01T00:00:00.000Z",
          class_state: "idle",
          class_notice: null,
          class_updated_at: "2024-01-01T00:00:00.000Z",
          rules_text: null,
          rules_updated_at: "2024-01-01T00:00:00.000Z",
          tools_enabled: [],
          tools_updated_at: "2024-01-01T00:00:00.000Z",
          ui_minimap_mode: null,
          ui_minimap_updated_at: null,
          ui_wallpaper_key: "paper-1",
          ui_wallpaper_updated_at: "2024-01-01T00:00:00.000Z",
          ui_theme_config: {
            id: "stored-theme",
            schemaVersion: 1,
            vars: {
              "--theme-bg": "#ffffff",
              "--theme-card-text": "#111827",
            },
          },
          ui_theme_updated_at: "2024-01-01T00:00:00.000Z",
        },
        error: null,
      },
    ],
    selected,
  );

  const board = await getBoardByShareCode("abc234", {
    createSupabaseAdminClientFn: () => admin as never,
  });

  assert.equal(board?.ui_wallpaper_key, "paper-1");
  assert.deepEqual(board?.ui_theme_config, {
    id: "stored-theme",
    schemaVersion: 1,
    vars: {
      "--theme-bg": "#ffffff",
      "--theme-card-text": "#111827",
    },
  });
  assert.equal(board?.ui_theme_updated_at, "2024-01-01T00:00:00.000Z");
  assert.equal(selected.length, 1);
  assert.match(selected[0] ?? "", /ui_wallpaper_key/);
  assert.match(selected[0] ?? "", /ui_theme_config/);
});

test("getBoardByShareCode falls back when ui_wallpaper_key column is missing", async () => {
  const selected: string[] = [];
  const admin = createAdminClientStub(
    [
      {
        data: null,
        error: {
          code: "42703",
          message: "column boards.ui_wallpaper_key does not exist",
        },
      },
      {
        data: {
          id: "board-2",
          owner_id: "teacher-2",
          title: "board",
          board_view_type: "wall",
          wall_v2_enabled: false,
          share_code: "abc234",
          share_enabled: true,
          share_updated_at: "2024-01-01T00:00:00.000Z",
          share_write_enabled: true,
          share_write_updated_at: "2024-01-01T00:00:00.000Z",
          class_state: "idle",
          class_notice: null,
          class_updated_at: "2024-01-01T00:00:00.000Z",
          rules_text: null,
          rules_updated_at: "2024-01-01T00:00:00.000Z",
          tools_enabled: [],
          tools_updated_at: "2024-01-01T00:00:00.000Z",
          ui_minimap_mode: null,
          ui_minimap_updated_at: null,
        },
        error: null,
      },
    ],
    selected,
  );

  const board = await getBoardByShareCode("abc234", {
    createSupabaseAdminClientFn: () => admin as never,
  });

  assert.equal(board?.id, "board-2");
  assert.equal(board?.ui_wallpaper_key ?? null, null);
  assert.equal(selected.length, 2);
  assert.match(selected[0] ?? "", /ui_wallpaper_key/);
  assert.doesNotMatch(selected[1] ?? "", /ui_wallpaper_key/);
});

test("getBoardByShareCode falls back when ui_theme_config column is missing", async () => {
  const selected: string[] = [];
  const admin = createAdminClientStub(
    [
      {
        data: null,
        error: {
          code: "42703",
          message: "column boards.ui_theme_config does not exist",
        },
      },
      {
        data: {
          id: "board-3",
          owner_id: "teacher-3",
          title: "board",
          board_view_type: "wall",
          wall_v2_enabled: false,
          share_code: "abc234",
          share_enabled: true,
          share_updated_at: "2024-01-01T00:00:00.000Z",
          share_write_enabled: true,
          share_write_updated_at: "2024-01-01T00:00:00.000Z",
          class_state: "idle",
          class_notice: null,
          class_updated_at: "2024-01-01T00:00:00.000Z",
          rules_text: null,
          rules_updated_at: "2024-01-01T00:00:00.000Z",
          tools_enabled: [],
          tools_updated_at: "2024-01-01T00:00:00.000Z",
          ui_minimap_mode: null,
          ui_minimap_updated_at: null,
          ui_wallpaper_key: "paper-3",
          ui_wallpaper_updated_at: "2024-01-01T00:00:00.000Z",
        },
        error: null,
      },
    ],
    selected,
  );

  const board = await getBoardByShareCode("abc234", {
    createSupabaseAdminClientFn: () => admin as never,
  });

  assert.equal(board?.id, "board-3");
  assert.equal(board?.ui_wallpaper_key, "paper-3");
  assert.equal(board?.ui_theme_config ?? null, null);
  assert.equal(selected.length, 2);
  assert.match(selected[0] ?? "", /ui_theme_config/);
  assert.doesNotMatch(selected[1] ?? "", /ui_theme_config/);
  assert.match(selected[1] ?? "", /ui_wallpaper_key/);
});

test("getBoardByShareCode rethrows non-schema-drift errors", async () => {
  const selected: string[] = [];
  const admin = createAdminClientStub(
    [
      {
        data: null,
        error: {
          code: "XX000",
          message: "unexpected error",
        },
      },
    ],
    selected,
  );

  await assert.rejects(
    () =>
      getBoardByShareCode("abc234", {
        createSupabaseAdminClientFn: () => admin as never,
      }),
    /unexpected error/,
  );
  assert.equal(selected.length, 1);
});
