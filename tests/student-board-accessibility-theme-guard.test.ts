import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  DEFAULT_BOARD_THEME,
  resolveStudentBoardTheme,
  type BoardThemeVars,
  type GuestViewThemeId,
} from "@/lib/ui/boardTheme";
import { contrastRatio } from "./helpers/textContrast";

const guestViews: GuestViewThemeId[] = ["follow-teacher", "bright", "contrast", "calm", "high-contrast"];

const requiredTopbar = [
  "--theme-topbar-bg",
  "--theme-topbar-text",
  "--theme-topbar-border",
  "--theme-topbar-pill-bg",
  "--theme-topbar-pill-text",
  "--theme-topbar-focus",
  "--theme-topbar-menu-bg",
  "--theme-topbar-menu-text",
  "--theme-topbar-menu-muted",
  "--theme-topbar-menu-border",
] as const;

const requiredCardPairs = [
  "--theme-card-text",
  "--theme-card-muted-text",
  "--theme-card-link-text",
  "--theme-section-bg",
  "--theme-section-text",
  "--theme-menu-bg",
  "--theme-menu-text",
  "--theme-owner-badge-bg",
  "--theme-owner-badge-text",
  "--theme-more-button-bg",
  "--theme-more-button-text",
  "--theme-file-badge-bg",
  "--theme-file-badge-text",
  "--theme-file-badge-border",
  "--theme-download-label-bg",
  "--theme-download-label-text",
  "--theme-download-label-border",
] as const;

const genericTextFloors = {
  "--theme-text": 7,
  "--theme-text-muted": 5.5,
  "--theme-text-subtle": 5,
} as const;

const genericSurfaces = [
  "--theme-bg",
  "--theme-surface",
  "--theme-surface-muted",
  "--theme-card",
  "--theme-card-muted",
] as const;

const semanticPairs: Array<{
  foreground: keyof BoardThemeVars;
  background: keyof BoardThemeVars;
  floor: number;
}> = [
  { foreground: "--theme-card-text", background: "--theme-card", floor: 4.5 },
  { foreground: "--theme-card-muted-text", background: "--theme-card", floor: 4.5 },
  { foreground: "--theme-card-link-text", background: "--theme-card", floor: 4.5 },
  { foreground: "--theme-section-text", background: "--theme-section-bg", floor: 4.5 },
  { foreground: "--theme-section-muted-text", background: "--theme-section-bg", floor: 4.5 },
  { foreground: "--theme-menu-text", background: "--theme-menu-bg", floor: 4.5 },
  { foreground: "--theme-menu-muted-text", background: "--theme-menu-bg", floor: 4.5 },
  { foreground: "--theme-owner-badge-text", background: "--theme-owner-badge-bg", floor: 4.5 },
  { foreground: "--theme-more-button-text", background: "--theme-more-button-bg", floor: 4.5 },
  { foreground: "--theme-file-badge-text", background: "--theme-file-badge-bg", floor: 4.5 },
  { foreground: "--theme-download-label-text", background: "--theme-download-label-bg", floor: 4.5 },
  { foreground: "--theme-topbar-text", background: "--theme-topbar-bg", floor: 4.5 },
  { foreground: "--theme-topbar-text-muted", background: "--theme-topbar-bg", floor: 4.5 },
  { foreground: "--theme-topbar-pill-text", background: "--theme-topbar-pill-bg", floor: 4.5 },
  { foreground: "--theme-topbar-menu-text", background: "--theme-topbar-menu-bg", floor: 4.5 },
  { foreground: "--theme-topbar-menu-muted", background: "--theme-topbar-menu-bg", floor: 4.5 },
];

function ratio(vars: BoardThemeVars, foreground: keyof BoardThemeVars, background: keyof BoardThemeVars) {
  return contrastRatio(vars[foreground], vars[background], vars["--theme-bg"]);
}

test("all student guest views keep generic readable text above the product floors", () => {
  for (const guestViewTheme of guestViews) {
    const vars = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme });
    for (const surface of genericSurfaces) {
      for (const role of Object.keys(genericTextFloors) as Array<keyof typeof genericTextFloors>) {
        const actual = ratio(vars, role, surface);
        assert.ok(
          actual >= genericTextFloors[role],
          `${guestViewTheme} ${role} on ${surface}: ${actual} < ${genericTextFloors[role]}`,
        );
      }
    }
  }
});

test("student semantic foreground/background pairs stay readable across every guest view", () => {
  for (const guestViewTheme of guestViews) {
    const vars = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme });
    for (const { foreground, background, floor } of semanticPairs) {
      const actual = ratio(vars, foreground, background);
      assert.ok(actual >= floor, `${guestViewTheme} ${foreground} on ${background}: ${actual} < ${floor}`);
    }
    for (const token of requiredTopbar) assert.ok(vars[token], `${guestViewTheme}: missing ${token}`);
    for (const token of requiredCardPairs) assert.ok(vars[token], `${guestViewTheme}: missing ${token}`);
  }
});

test("high-contrast mode still owns the strongest dim policy and enhanced text ratios", () => {
  const high = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "high-contrast" });
  const bright = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "bright" });
  const calm = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "calm" });

  assert.ok(Number(high["--board-bg-dim-opacity"]) > Number(bright["--board-bg-dim-opacity"]));
  assert.ok(Number(high["--board-surface-opacity"]) > Number(calm["--board-surface-opacity"]));
  assert.ok(ratio(high, "--theme-text", "--theme-card") >= 7);
  assert.ok(ratio(high, "--theme-text-muted", "--theme-card") >= 4.5);
  assert.ok(ratio(high, "--theme-topbar-text", "--theme-topbar-bg") >= 7);
  assert.ok(ratio(high, "--theme-topbar-menu-text", "--theme-topbar-menu-bg") >= 7);
  assert.ok(ratio(high, "--theme-topbar-pill-text", "--theme-topbar-pill-bg") >= 7);
  assert.ok(ratio(high, "--theme-card-text", "--theme-card") >= 7);
  assert.ok(ratio(high, "--theme-section-text", "--theme-section-bg") >= 7);
  assert.ok(ratio(high, "--theme-menu-text", "--theme-menu-bg") >= 7);
  assert.ok(high["--theme-focus"].length > 0);
});

test("gomdory studio wall styling keeps readable text on semantic role owners", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const board = fs.readFileSync("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");

  assert.doesNotMatch(css, /^\s*color:\s*.*var\(--student-wall-ink\)/m);
  assert.match(css, /student-topbar-collapsed[\s\S]*background:\s*var\(--theme-topbar-pill-bg\)[\s\S]*color:\s*var\(--theme-topbar-pill-text\)/);
  assert.match(css, /student-topbar-expanded[\s\S]*background:\s*var\(--theme-topbar-bg\)[\s\S]*color:\s*var\(--theme-topbar-text\)/);
  assert.match(css, /data-attachment-extension-badge[\s\S]*color:\s*var\(--theme-card-muted-text\)\s*!important/);
  assert.match(css, /card-read-more-button[\s\S]*color:\s*var\(--theme-card-link-text\)/);
  assert.match(css, /data-student-card-meta[\s\S]*color:\s*var\(--theme-card-muted-text\)/);
  assert.match(css, /data-student-card-menu-trigger[\s\S]*background:\s*var\(--theme-more-button-bg\)\s*!important/);
  assert.match(css, /student-owned-card-badge[\s\S]*background:\s*var\(--theme-owner-badge-bg\)[\s\S]*color:\s*var\(--theme-owner-badge-text\)/);
  assert.match(css, /data-student-context-menu[\s\S]*background:\s*var\(--theme-menu-bg\)[\s\S]*color:\s*var\(--theme-menu-text\)/);

  assert.match(board, /data-student-context-menu="column"[\s\S]*border-\[var\(--theme-menu-border\)\][\s\S]*bg-\[var\(--theme-menu-bg\)\][\s\S]*text-\[var\(--theme-menu-text\)\]/);
  assert.match(board, /data-student-context-menu="card"[\s\S]*hover:bg-\[var\(--theme-menu-hover-bg\)\]/);
});

test("high-contrast UI uses theme-token classes for key affordances", async () => {
  const wallColumn = await fs.promises.readFile("app/_components/WallColumn.tsx", "utf8");
  const cardText = await fs.promises.readFile("app/_components/CollapsibleCardText.tsx", "utf8");
  const miniMap = await fs.promises.readFile("app/_components/BoardMiniMap.tsx", "utf8");

  assert.match(wallColumn, /data-testid="guest-card-compose-cta"[\s\S]*theme-border-strong/);
  assert.match(cardText, /data-testid="card-read-more-button"[\s\S]*theme-border-strong/);
  assert.match(miniMap, /data-testid="board-minimap-panel"[\s\S]*theme-border-strong/);
  assert.match(miniMap, /data-testid="board-minimap-trigger"[\s\S]*theme-focus/);
});
