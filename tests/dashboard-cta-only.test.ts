import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ModeShell from "@/app/dashboard/_components/ModeShell";
import BoardTileClean from "@/app/dashboard/_components/BoardTileClean";
import BoardTileManage from "@/app/dashboard/_components/BoardTileManage";
import type { DashboardBoardSummary } from "@/lib/data/boards";

const sampleBoard: DashboardBoardSummary = {
  boardId: "board-1",
  title: "테스트 보드",
  description: "설명",
  created_at: "2024-01-01T00:00:00Z",
  board_view_type: "wall",
  shareCode: "ABCD",
  shareEnabled: true,
};

function assertAnchorsAreInteractive(html: string) {
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  for (const anchor of anchors) {
    assert.ok(
      anchor.includes('data-interactive="true"'),
      `Anchor missing data-interactive=true: ${anchor}`,
    );
  }
}

test("mode shell includes data-page-marker per mode", () => {
  (["clean", "focus", "manage"] as const).forEach((mode) => {
    const html = renderToStaticMarkup(
      createElement(
        ModeShell,
        {
          mode,
          title: `${mode}-title`,
          description: `${mode}-desc`,
          rightActions: null,
          modeSwitcher: null,
        },
        createElement("div", null, "content"),
      ),
    );

    assert.ok(html.includes(`data-page-marker=\"dashboard-${mode}\"`));
  });
});

test("dashboard tiles only expose CTA anchors", () => {
  const cleanHtml = renderToStaticMarkup(
    createElement(BoardTileClean, {
      board: sampleBoard,
      pinned: true,
      recent: true,
      onRecent: () => undefined,
    }),
  );

  const manageHtml = renderToStaticMarkup(
    createElement(BoardTileManage, {
      board: sampleBoard,
      pinned: true,
      recent: false,
      selected: true,
      onSelect: () => undefined,
      onPin: () => undefined,
      onUnpin: () => undefined,
      onMoveUp: () => undefined,
      onMoveDown: () => undefined,
      onDeleteConfirm: () => undefined,
    }),
  );

  assert.ok(cleanHtml.includes("data-dashboard-tile"));
  assert.ok(manageHtml.includes("data-dashboard-tile"));

  assertAnchorsAreInteractive(cleanHtml);
  assertAnchorsAreInteractive(manageHtml);
});

test("focus tiles keep CTA-only anchors", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "_components", "BoardTileFocusMini.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  const anchors = content.match(/<a\b[^>]*>/g) ?? [];
  for (const anchor of anchors) {
    assert.ok(
      anchor.includes('data-interactive="true"'),
      `Anchor missing data-interactive=true: ${anchor}`,
    );
  }
});
