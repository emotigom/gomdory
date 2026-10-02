import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_BOARD_THEME, normalizeGuestViewThemeId, normalizePersistedBoardTheme, resolveBoardThemeVars, resolveStudentBoardTheme, type BoardThemeTokens } from "@/lib/ui/boardTheme";

const REQUIRED = [
  "--theme-bg","--theme-surface","--theme-surface-muted","--theme-card","--theme-card-strong","--theme-text","--theme-text-muted","--theme-border","--theme-focus","--theme-accent","--theme-accent-contrast","--theme-danger","--theme-success","--board-bg-dim-opacity","--board-surface-opacity","--theme-topbar-bg","--theme-topbar-text","--theme-topbar-text-muted","--theme-topbar-border","--theme-topbar-pill-bg","--theme-topbar-pill-text","--theme-topbar-focus","--theme-topbar-menu-bg","--theme-topbar-menu-text","--theme-topbar-menu-border","--theme-section-bg","--theme-section-border","--theme-section-text","--theme-section-muted-text","--theme-menu-bg","--theme-menu-text","--theme-menu-muted-text","--theme-menu-border","--theme-menu-hover-bg","--theme-menu-danger-text","--theme-menu-danger-hover-bg","--theme-owner-badge-bg","--theme-owner-badge-text","--theme-owner-badge-border","--theme-more-button-bg","--theme-more-button-text","--theme-more-button-border","--theme-more-button-hover-bg",
] as const;

test("default theme includes required shared + topbar tokens", () => {
  for (const token of REQUIRED) assert.ok(DEFAULT_BOARD_THEME.vars[token]);
});

test("teacher/student resolvers return required vars", () => {
  const teacher = resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher");
  const student = resolveBoardThemeVars(DEFAULT_BOARD_THEME, "student");
  for (const token of REQUIRED) {
    assert.ok(teacher[token]);
    assert.ok(student[token]);
  }
});

test("follow-teacher uses board theme as base and invalid values fallback", () => {
  const boardTheme: BoardThemeTokens = { ...DEFAULT_BOARD_THEME, vars: { ...DEFAULT_BOARD_THEME.vars, "--theme-text": "#111827" } };
  const follow = resolveStudentBoardTheme({ boardTheme, guestViewTheme: "follow-teacher" });
  assert.equal(follow["--theme-text"], "#111827");
  assert.equal(normalizeGuestViewThemeId("oops"), "follow-teacher");
});

test("persisted board theme payload is normalized before resolver use", () => {
  const persisted = normalizePersistedBoardTheme({
    id: "stored-theme",
    label: "Stored theme",
    schemaVersion: 1,
    vars: {
      "--theme-card-text": "#111827",
      "--theme-topbar-text": "#111827",
      "--not-a-theme-token": "#ffffff",
    },
  });

  assert.ok(persisted);
  assert.equal(persisted.id, "stored-theme");
  assert.equal(persisted.vars["--theme-card-text"], "#111827");
  assert.equal(persisted.vars["--theme-topbar-text"], "#111827");

  const teacher = resolveBoardThemeVars(persisted, "teacher");
  const student = resolveStudentBoardTheme({ boardTheme: persisted, guestViewTheme: "follow-teacher" });
  assert.equal(teacher["--theme-card-text"], "#111827");
  assert.equal(student["--theme-card-text"], "#111827");
});

test("teacher/share/student round-trip keeps stored theme as display base", () => {
  const sharePayload = {
    id: "board-1",
    title: "Round trip",
    ui_theme_config: {
      id: "stored-theme",
      label: "Stored theme",
      schemaVersion: 1,
      vars: {
        "--theme-bg": "#ffffff",
        "--theme-card": "#f8fafc",
        "--theme-card-text": "#111827",
        "--theme-topbar-bg": "#ffffff",
        "--theme-topbar-text": "#111827",
        "--board-bg-dim-opacity": "0.22",
      },
    },
  };

  const persisted = normalizePersistedBoardTheme(sharePayload.ui_theme_config);
  assert.ok(persisted);

  const teacher = resolveBoardThemeVars(persisted, "teacher");
  const studentFollow = resolveStudentBoardTheme({ boardTheme: persisted, guestViewTheme: "follow-teacher" });
  const studentBright = resolveStudentBoardTheme({ boardTheme: persisted, guestViewTheme: "bright" });

  assert.equal(teacher["--theme-card-text"], "#111827");
  assert.equal(studentFollow["--theme-card-text"], "#111827");
  assert.equal(studentFollow["--theme-topbar-text"], "#111827");
  assert.equal(studentBright["--theme-card-text"], "#0f172a");
  assert.equal(studentBright["--theme-topbar-text"], "#111827");
  assert.equal(persisted.vars["--theme-card-text"], "#111827");
});

test("student local view modes derive display vars without mutating stored theme", () => {
  const persisted = normalizePersistedBoardTheme({
    id: "stored-theme",
    vars: {
      "--theme-bg": "#ffffff",
      "--theme-card": "#f8fafc",
      "--theme-card-text": "#111827",
      "--theme-focus": "#2563eb",
    },
  });

  assert.ok(persisted);
  const before = JSON.stringify(persisted);
  for (const guestViewTheme of ["bright", "contrast", "calm", "high-contrast"] as const) {
    const resolved = resolveStudentBoardTheme({ boardTheme: persisted, guestViewTheme });
    assert.ok(resolved["--theme-card-text"]);
    assert.notEqual(resolved["--theme-focus"], "");
  }
  assert.equal(JSON.stringify(persisted), before);
  assert.equal(persisted.vars["--theme-card-text"], "#111827");
  assert.equal(persisted.vars["--theme-focus"], "#2563eb");
});

test("student themes provide menu and more-button token pairs", () => {
  for (const guestViewTheme of ["follow-teacher", "bright", "contrast", "calm", "high-contrast"] as const) {
    const theme = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme });
    for (const token of [
      "--theme-more-button-bg",
      "--theme-more-button-text",
      "--theme-menu-bg",
      "--theme-menu-text",
      "--theme-menu-muted-text",
      "--theme-menu-danger-text",
    ] as const) {
      assert.ok(theme[token], `${guestViewTheme} is missing ${token}`);
    }
  }
});

test("follow-teacher default menu keeps an opaque surface and readable disabled text", () => {
  const follow = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "follow-teacher" });
  assert.equal(follow["--theme-menu-bg"], "#f8fafc");
  assert.equal(follow["--theme-menu-text"], "#0f172a");
  assert.equal(follow["--theme-menu-muted-text"], "#334155");
});


test("theme mode semantics: bright/contrast/calm differ intentionally", () => {
  const follow = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "follow-teacher" });
  const bright = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "bright" });
  const contrast = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "contrast" });
  const calm = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "calm" });

  assert.ok(Number(bright["--board-bg-dim-opacity"]) < Number(follow["--board-bg-dim-opacity"]) || Number(bright["--board-surface-opacity"]) < Number(follow["--board-surface-opacity"]));
  assert.ok(Number(contrast["--board-bg-dim-opacity"]) <= 0.08);
  assert.notEqual(contrast["--theme-focus"], follow["--theme-focus"]);
  assert.notEqual(contrast["--theme-accent"], follow["--theme-accent"]);

  assert.ok(calm["--theme-danger"].length > 0);
  assert.ok(calm["--theme-focus"].length > 0);
  assert.ok(calm["--theme-accent"].length > 0);
  assert.ok(Number(calm["--board-bg-dim-opacity"]) <= 0.06);
  assert.ok(Number(follow["--board-bg-dim-opacity"]) <= 0.04);
  assert.ok(Number(bright["--board-bg-dim-opacity"]) <= 0.03);
});
