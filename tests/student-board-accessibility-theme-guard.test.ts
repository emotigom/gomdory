import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_BOARD_THEME, resolveStudentBoardTheme } from "@/lib/ui/boardTheme";

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

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
};
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

test("high-contrast tokens meet readability guardrails", () => {
  const high = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "high-contrast" });
  const bright = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "bright" });
  const calm = resolveStudentBoardTheme({ boardTheme: DEFAULT_BOARD_THEME, guestViewTheme: "calm" });

  assert.ok(Number(high["--board-bg-dim-opacity"]) > Number(bright["--board-bg-dim-opacity"]));
  assert.ok(Number(high["--board-surface-opacity"]) > Number(calm["--board-surface-opacity"]));
  assert.ok(contrast(high["--theme-text"], high["--theme-card"]) >= 7);
  assert.ok(contrast(high["--theme-text-muted"], high["--theme-card"]) >= 4.5);
  assert.ok(contrast(high["--theme-accent"], high["--theme-card"]) >= 4.5);
  assert.ok(contrast(high["--theme-danger"], high["--theme-card"]) >= 4.5);
  assert.ok(contrast(high["--theme-focus"], high["--theme-card"]) >= 3);
  assert.ok(contrast(high["--theme-topbar-text"], high["--theme-topbar-bg"]) >= 7);
  assert.ok(contrast(high["--theme-topbar-menu-text"], high["--theme-topbar-menu-bg"]) >= 7);
  assert.ok(contrast(high["--theme-topbar-pill-text"], high["--theme-topbar-pill-bg"]) >= 7);
  assert.ok(contrast(high["--theme-card-text"], high["--theme-card"]) >= 7);
  assert.ok(contrast(high["--theme-card-muted-text"], high["--theme-card"]) >= 4.5);
  assert.ok(contrast(high["--theme-card-link-text"], high["--theme-card"]) >= 4.5);
  assert.ok(contrast(high["--theme-section-text"], high["--theme-section-bg"]) >= 7);
  assert.ok(contrast(high["--theme-menu-text"], high["--theme-menu-bg"]) >= 7);
  assert.ok(contrast(high["--theme-owner-badge-text"], high["--theme-owner-badge-bg"]) >= 7);
  assert.ok(contrast(high["--theme-more-button-text"], high["--theme-more-button-bg"]) >= 7);
  assert.ok(contrast(high["--theme-file-badge-text"], high["--theme-file-badge-bg"]) >= 7);
  assert.ok(contrast(high["--theme-download-label-text"], high["--theme-download-label-bg"]) >= 7);
  assert.ok(high["--theme-focus"].length > 0);
  for (const token of requiredTopbar) assert.ok(high[token]);
  for (const token of requiredCardPairs) assert.ok(high[token]);
});

test("high-contrast UI uses theme-token classes for key affordances", async () => {
  const fs = await import("node:fs/promises");
  const wallColumn = await fs.readFile("app/_components/WallColumn.tsx", "utf8");
  const cardText = await fs.readFile("app/_components/CollapsibleCardText.tsx", "utf8");
  const miniMap = await fs.readFile("app/_components/BoardMiniMap.tsx", "utf8");

  assert.match(wallColumn, /data-testid=\"guest-card-compose-cta\"[\s\S]*theme-border-strong/);
  assert.match(cardText, /data-testid=\"card-read-more-button\"[\s\S]*theme-border-strong/);
  assert.match(miniMap, /data-testid=\"board-minimap-panel\"[\s\S]*theme-border-strong/);
  assert.match(miniMap, /data-testid=\"board-minimap-trigger\"[\s\S]*theme-focus/);
});
