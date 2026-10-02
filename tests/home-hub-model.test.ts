import assert from "node:assert/strict";
import test from "node:test";

import { BoardsSlot, buildDashboardHomeHubModel, TroubleshootSlot } from "@/lib/dashboard/homeHubData";

test("buildDashboardHomeHubModel returns stable fallback model when envMissing=true", () => {
  const model = buildDashboardHomeHubModel({
    envMissing: true,
    boards: [
      {
        id: "board-1",
        title: "Ignored",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    authState: { isAuthenticated: true },
    requestId: "req-homehub-1",
  });

  assert.equal(model.nextAction.hint, "데이터 연결 필요");
  assert.equal(model.now.emptyMessage, "데이터 연결 필요");
  assert.equal(model.now.items.length, 1);
  assert.equal(model.now.items[0]?.id, "troubleshoot-env");
  assert.equal(model.shortcuts.items.length, 4);
  assert.deepEqual(model.debugMarkers, {
    kind: "env-missing",
    message: "데이터 연결 필요",
    requestId: "req-homehub-1",
  });
});

test("buildDashboardHomeHubModel composes slots in provided order", () => {
  const model = buildDashboardHomeHubModel({
    envMissing: false,
    boards: [
      {
        id: "board-1",
        title: "Board 1",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    slots: [
      {
        id: "custom-a",
        build: () => ({
          now: { items: [{ id: "a", title: "A", createdAtLabel: "A" }] },
          shortcuts: { items: [{ id: "shortcut-a", label: "A", href: "/a" }] },
        }),
      },
      BoardsSlot,
      {
        id: "custom-b",
        build: () => ({
          now: { items: [{ id: "b", title: "B", createdAtLabel: "B" }] },
          shortcuts: { items: [{ id: "shortcut-b", label: "B", href: "/b" }] },
        }),
      },
    ],
  });

  assert.deepEqual(
    model.now.items.map((item) => item.id),
    ["a", "board-1", "b"],
  );
  assert.deepEqual(
    model.shortcuts.items.map((item) => item.id),
    ["file", "gallery", "template", "settings", "shortcut-a", "shortcut-b"],
  );
});

test("TroubleshootSlot creates one-line item only when envMissing=true", () => {
  const withMissing = TroubleshootSlot.build({ envMissing: true });
  const withoutMissing = TroubleshootSlot.build({ envMissing: false });

  assert.equal(withMissing.now?.items?.length, 1);
  assert.equal(withMissing.now?.items?.[0]?.id, "troubleshoot-env");
  assert.equal(withoutMissing.now?.items?.length, 0);
});
