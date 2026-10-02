import assert from "node:assert/strict";
import test from "node:test";

import { PATCH } from "@/app/api/v1/boards/[boardId]/settings/route";
import { DEFAULT_BOARD_THEME } from "@/lib/ui/boardTheme";

const boardId = "11111111-1111-1111-1111-111111111111";
const user = { id: "teacher-1" };
const savedAt = "2026-06-30T12:34:56.000Z";

function request(patch: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/boards/${boardId}/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: "test-request", patch }),
  });
}

function createSupabaseStub(options?: { role?: string; updateError?: { code?: string; message: string } }) {
  const calls: { updates: Record<string, unknown> | null; selectColumns: string | null } = {
    updates: null,
    selectColumns: null,
  };
  const supabase = {
    rpc: async () => ({ data: options?.role ?? "owner", error: null }),
    from: (table: string) => {
      assert.equal(table, "boards");
      return {
        update: (updates: Record<string, unknown>) => {
          calls.updates = updates;
          return {
            eq: () => ({
              eq: () => ({
                select: (columns: string) => {
                  calls.selectColumns = columns;
                  return {
                    maybeSingle: async () => ({
                      data: options?.updateError
                        ? null
                        : {
                            id: boardId,
                            title: updates.title ?? "Existing board",
                            description: updates.description ?? "Existing description",
                            ui_wallpaper_key: updates.ui_wallpaper_key ?? "wallpaper-1",
                            ui_wallpaper_updated_at: updates.ui_wallpaper_updated_at ?? "2026-06-01T00:00:00.000Z",
                            ui_theme_config: updates.ui_theme_config ?? {
                              id: "stored-theme",
                              label: "Stored theme",
                              vars: { ...DEFAULT_BOARD_THEME.vars, "--theme-bg": "#ffffff" },
                            },
                            ui_theme_updated_at: updates.ui_theme_updated_at ?? "2026-06-01T00:00:00.000Z",
                          },
                      error: options?.updateError ?? null,
                    }),
                  };
                },
              }),
            }),
          };
        },
      };
    },
  };

  return { calls, supabase };
}

async function patchSettings(
  patch: Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseStub>["supabase"],
  options?: { requireUserApiFn?: () => Promise<never> },
) {
  return PATCH(
    request(patch),
    { params: Promise.resolve({ boardId }) },
    {
      createSupabaseServerClientFn: () => supabase as never,
      requireUserApiFn: options?.requireUserApiFn ?? (async () => ({ user }) as never),
      nowFn: () => new Date(savedAt),
    },
  );
}

test("settings PATCH keeps ui_theme_config when uiThemeConfig is omitted", async () => {
  const { calls, supabase } = createSupabaseStub();

  const response = await patchSettings({ title: " Updated board " }, supabase);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(calls.updates, { title: "Updated board" });
  assert.equal(Object.hasOwn(calls.updates ?? {}, "ui_theme_config"), false);
  assert.equal(Object.hasOwn(calls.updates ?? {}, "ui_theme_updated_at"), false);
});

test("settings PATCH normalizes valid uiThemeConfig before saving", async () => {
  const { calls, supabase } = createSupabaseStub();

  const response = await patchSettings(
    {
      uiThemeConfig: {
        id: "stored-theme",
        label: " Stored theme ",
        schemaVersion: 1,
        vars: {
          "--theme-bg": "#ffffff",
          "--theme-card-text": "#111827",
          "--board-bg-dim-opacity": "0.25",
          "--board-surface-opacity": "9",
          "--not-a-theme-token": "#111111",
        },
      },
    },
    supabase,
  );

  assert.equal(response.status, 200);
  assert.equal(calls.updates?.ui_theme_updated_at, savedAt);
  const saved = calls.updates?.ui_theme_config as typeof DEFAULT_BOARD_THEME | undefined;
  assert.ok(saved);
  assert.equal(saved.id, "stored-theme");
  assert.equal(saved.label, "Stored theme");
  assert.equal(saved.vars["--theme-bg"], "#ffffff");
  assert.equal(saved.vars["--board-bg-dim-opacity"], "0.25");
  assert.equal(saved.vars["--theme-card-text"], "#111827");
  assert.equal(saved.vars["--board-surface-opacity"], DEFAULT_BOARD_THEME.vars["--board-surface-opacity"]);
  assert.equal(Object.hasOwn(saved.vars, "--not-a-theme-token"), false);
});

test("settings PATCH updates ui_theme_updated_at only when theme is saved", async () => {
  const { calls: themeCalls, supabase: themeSupabase } = createSupabaseStub();
  const themeResponse = await patchSettings({ uiThemeConfig: DEFAULT_BOARD_THEME }, themeSupabase);
  assert.equal(themeResponse.status, 200);
  assert.equal(themeCalls.updates?.ui_theme_updated_at, savedAt);

  const { calls: descriptionCalls, supabase: descriptionSupabase } = createSupabaseStub();
  const descriptionResponse = await patchSettings({ description: "Only description" }, descriptionSupabase);
  assert.equal(descriptionResponse.status, 200);
  assert.equal(Object.hasOwn(descriptionCalls.updates ?? {}, "ui_theme_updated_at"), false);
  assert.equal(Object.hasOwn(descriptionCalls.updates ?? {}, "ui_theme_config"), false);
});

test("settings PATCH rejects null uiThemeConfig under the current explicit-default contract", async () => {
  const { calls, supabase } = createSupabaseStub();

  const response = await patchSettings({ uiThemeConfig: null }, supabase);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.equal(payload.error.message, "invalid_theme_config");
  assert.equal(calls.updates, null);
});

test("settings PATCH denies uiThemeConfig for unauthenticated users without touching theme timestamps", async () => {
  const { calls, supabase } = createSupabaseStub();

  const response = await patchSettings(
    { uiThemeConfig: DEFAULT_BOARD_THEME },
    supabase,
    { requireUserApiFn: async () => { throw new Error("unauthorized"); } },
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "UNAUTHORIZED");
  assert.equal(calls.updates, null);
});

test("settings PATCH denies uiThemeConfig for non-owner board roles", async () => {
  for (const role of ["viewer", "editor"] as const) {
    const { calls, supabase } = createSupabaseStub({ role });

    const response = await patchSettings({ uiThemeConfig: DEFAULT_BOARD_THEME }, supabase);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, "FORBIDDEN");
    assert.equal(calls.updates, null);
  }
});

test("settings PATCH denies mixed settings and uiThemeConfig for unauthorized board roles without changing theme", async () => {
  const { calls, supabase } = createSupabaseStub({ role: "viewer" });

  const response = await patchSettings({ title: "Intruder edit", uiThemeConfig: DEFAULT_BOARD_THEME }, supabase);

  assert.equal(response.status, 403);
  assert.equal(calls.updates, null);
});

test("settings PATCH rejects non-object uiThemeConfig payloads", async () => {
  for (const uiThemeConfig of ["teacher-default-hud", 1, true, ["teacher-default-hud"]]) {
    const { calls, supabase } = createSupabaseStub();

    const response = await patchSettings({ uiThemeConfig }, supabase);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.message, "invalid_theme_config");
    assert.equal(calls.updates, null);
  }
});

test("settings PATCH rejects dangerous theme CSS values instead of silently storing fallbacks", async () => {
  for (const value of ["url(https://example.test/a.png)", "var(--theme-bg)", "calc(100% - 1px)", "expression(alert(1))", "javascript:alert(1)"]) {
    const { calls, supabase } = createSupabaseStub();

    const response = await patchSettings({
      uiThemeConfig: {
        id: "stored-theme",
        schemaVersion: 1,
        vars: { "--theme-bg": value },
      },
    }, supabase);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.message, "invalid_theme_config");
    assert.equal(calls.updates, null);
  }
});

test("settings PATCH rejects oversized or malformed nested uiThemeConfig payloads", async () => {
  const oversizedVars = Object.fromEntries(Array.from({ length: 120 }, (_, index) => [`--unexpected-${index}`, "#ffffff"]));

  for (const uiThemeConfig of [
    { id: "stored-theme", vars: oversizedVars },
    { id: "stored-theme", vars: ["#ffffff"] },
    { id: "stored-theme", vars: { "--theme-bg": "#ffffff".repeat(3000) } },
  ]) {
    const { calls, supabase } = createSupabaseStub();

    const response = await patchSettings({ uiThemeConfig }, supabase);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.message, "invalid_theme_config");
    assert.equal(calls.updates, null);
  }
});

test("settings PATCH leaves ui_theme_updated_at untouched when theme validation fails", async () => {
  const { calls, supabase } = createSupabaseStub();

  const response = await patchSettings({
    uiThemeConfig: {
      id: "stored-theme",
      schemaVersion: 1,
      vars: { "--theme-bg": "url(https://example.test/a.png)" },
    },
  }, supabase);

  assert.equal(response.status, 400);
  assert.equal(calls.updates, null);
});
