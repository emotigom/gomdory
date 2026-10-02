import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_BOARD_THEME, normalizeGuestViewThemeId, normalizePersistedBoardTheme, resolveBoardThemeVars, resolveStudentBoardTheme } from "@/lib/ui/boardTheme";
import { BOARD_THEME_PRESETS } from "@/lib/ui/boardTheme";

test("default board theme has required tokens", () => {
  const vars = DEFAULT_BOARD_THEME.vars;
  for (const key of [
    "--theme-text",
    "--theme-card",
    "--theme-card-text",
    "--theme-card-muted-text",
    "--theme-card-link-text",
    "--theme-section-bg",
    "--theme-section-border",
    "--theme-section-text",
    "--theme-section-muted-text",
    "--theme-menu-bg",
    "--theme-menu-text",
    "--theme-menu-border",
    "--theme-menu-hover-bg",
    "--theme-owner-badge-bg",
    "--theme-owner-badge-text",
    "--theme-owner-badge-border",
    "--theme-more-button-bg",
    "--theme-more-button-text",
    "--theme-more-button-border",
    "--theme-more-button-hover-bg",
    "--theme-file-badge-bg",
    "--theme-file-badge-text",
    "--theme-file-badge-border",
    "--theme-download-label-bg",
    "--theme-download-label-text",
    "--theme-download-label-border",
    "--theme-accent",
    "--theme-focus",
    "--theme-danger",
    "--board-bg-dim-opacity",
    "--board-surface-opacity",
  ] as const) {
    assert.ok(vars[key].trim().length > 0);
  }
});

test("teacher and student resolvers return role-safe variables", () => {
  const teacherVars = resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher");
  const studentVars = resolveBoardThemeVars(DEFAULT_BOARD_THEME, "student");
  assert.ok(teacherVars["--board-surface-opacity"].length > 0);
  assert.equal(studentVars["--board-surface-opacity"], "0.12");
});

test("follow-teacher keeps base tokens and invalid local value falls back", () => {
  assert.equal(normalizeGuestViewThemeId("wrong"), "follow-teacher");
  const resolved = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "follow-teacher" });
  assert.equal(resolved["--theme-bg"], DEFAULT_BOARD_THEME.vars["--theme-bg"]);
});

test("persisted board theme normalization rejects unsafe payload shapes", () => {
  assert.equal(normalizePersistedBoardTheme(null), null);
  assert.equal(normalizePersistedBoardTheme(undefined), null);
  assert.equal(normalizePersistedBoardTheme({}), null);
  assert.equal(normalizePersistedBoardTheme("unknown-preset"), null);
  assert.equal(normalizePersistedBoardTheme({ preset: "unknown-preset", vars: { "--theme-bg": "#ffffff" } }), null);
  assert.equal(normalizePersistedBoardTheme({ schemaVersion: 0, vars: { "--theme-bg": "#ffffff" } }), null);
  assert.equal(normalizePersistedBoardTheme({ schema_version: "1", vars: { "--theme-bg": "#ffffff" } }), null);
});

test("persisted board theme normalization safely merges valid tokens only", () => {
  const persistedInput = {
    id: "teacher-default-hud",
    label: " Stored ",
    schemaVersion: 1,
    extra: "ignored",
    vars: {
      "--theme-bg": "#ffffff",
      "--theme-card-text": "javascript:alert(1)",
      "--theme-topbar-bg": "rgba(255,255,255,0.92)",
      "--board-bg-dim-opacity": "0.25",
      "--board-surface-opacity": "4",
      "--not-a-theme-token": "#000000",
    },
  };

  const normalized = normalizePersistedBoardTheme(persistedInput);

  assert.ok(normalized);
  assert.equal(normalized.label, "Stored");
  assert.equal(normalized.vars["--theme-bg"], "#ffffff");
  assert.equal(normalized.vars["--theme-topbar-bg"], "rgba(255,255,255,0.92)");
  assert.equal(normalized.vars["--board-bg-dim-opacity"], "0.25");
  assert.equal(normalized.vars["--theme-card-text"], DEFAULT_BOARD_THEME.vars["--theme-card-text"]);
  assert.equal(normalized.vars["--board-surface-opacity"], DEFAULT_BOARD_THEME.vars["--board-surface-opacity"]);
});

test("persisted board theme normalization does not merge dangerous CSS strings", () => {
  for (const value of ["url(https://example.test/a.png)", "var(--theme-bg)", "calc(100% - 1px)", "expression(alert(1))", "javascript:alert(1)"]) {
    const normalized = normalizePersistedBoardTheme({
      id: "stored-theme",
      schemaVersion: 1,
      vars: {
        "--theme-bg": "#ffffff",
        "--theme-card-text": value,
      },
    });

    assert.ok(normalized);
    assert.equal(normalized.vars["--theme-bg"], "#ffffff");
    assert.equal(normalized.vars["--theme-card-text"], DEFAULT_BOARD_THEME.vars["--theme-card-text"]);
  }
});

test("board theme presets include supported teacher choices", () => {
  const ids = BOARD_THEME_PRESETS.map((preset) => preset.id);
  assert.deepEqual(ids, ["teacher-default-hud", "calm", "bright", "contrast", "high-contrast"]);
  for (const preset of BOARD_THEME_PRESETS) {
    const normalized = normalizePersistedBoardTheme(preset);
    assert.ok(normalized);
    assert.equal(normalized.id, preset.id);
    assert.ok(resolveBoardThemeVars(normalized, "teacher")["--theme-bg"]);
  }
});
