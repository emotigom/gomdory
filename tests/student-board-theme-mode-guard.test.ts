import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BOARD_THEME,
  normalizeGuestViewThemeId,
  resolveStudentBoardTheme,
  type GuestViewThemeId,
} from "@/lib/ui/boardTheme";

const THEMES: GuestViewThemeId[] = ["follow-teacher", "bright", "contrast", "calm", "high-contrast"];

test("all student guest view theme ids resolve with intentional dim differences", () => {
  const resolved = new Map(THEMES.map((id) => [id, resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: id })]));
  assert.equal(resolved.size, 5);
  for (const id of THEMES) {
    const vars = resolved.get(id)!;
    assert.ok(vars["--board-bg-dim-opacity"]);
    assert.ok(vars["--board-surface-opacity"]);
    assert.ok(vars["--theme-topbar-focus"]);
  }

  assert.ok(Number(resolved.get("bright")!["--board-bg-dim-opacity"]) < Number(resolved.get("follow-teacher")!["--board-bg-dim-opacity"]));
  assert.ok(Number(resolved.get("contrast")!["--board-bg-dim-opacity"]) <= 0.08);
  assert.ok(Number(resolved.get("follow-teacher")!["--board-bg-dim-opacity"]) <= 0.04);
  assert.ok(Number(resolved.get("calm")!["--board-bg-dim-opacity"]) <= 0.06);
  assert.equal(Number(resolved.get("bright")!["--board-bg-dim-opacity"]), 0);
  assert.equal(Number(resolved.get("bright")!["--board-surface-opacity"]), 0);
});

test("invalid localStorage value falls back to follow-teacher", () => {
  assert.equal(normalizeGuestViewThemeId("bad-value"), "follow-teacher");
});


test("high-contrast mode applies strongest readability dim policy", () => {
  const high = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "high-contrast" });
  const bright = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "bright" });
  const calm = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "calm" });
  assert.ok(Number(high["--board-bg-dim-opacity"]) > Number(bright["--board-bg-dim-opacity"]));
  assert.ok(Number(high["--board-surface-opacity"]) > Number(calm["--board-surface-opacity"]));
});

test("student theme mode is localStorage-only and does not write board theme config", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");
  const themeStorageBlock = source.slice(source.indexOf("const guestThemeStorageKey"), source.indexOf("const resolvedThemeVars"));

  assert.match(themeStorageBlock, /window\.localStorage\.setItem\(guestThemeStorageKey, nextTheme\)/);
  assert.doesNotMatch(themeStorageBlock, /fetch\(/);
  assert.doesNotMatch(themeStorageBlock, /\.update\(/);
  assert.doesNotMatch(themeStorageBlock, /ui_theme_config/);
});
