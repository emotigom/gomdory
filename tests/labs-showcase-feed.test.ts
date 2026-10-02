import assert from "node:assert/strict";
import test from "node:test";

import { buildLabsShowcaseFeed } from "@/lib/labs/showcaseFeed.server";

test("orders boards with last opened first, then pinned, then recent", async () => {
  const feed = await buildLabsShowcaseFeed("user-1", {
    listBoards: async () => [
      { id: "recent", title: "Recent", created_at: "2026-01-03T00:00:00.000Z" },
      { id: "last", title: "Last", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "pin-a", title: "Pin A", created_at: "2026-01-01T00:00:00.000Z", class_updated_at: "2026-01-04T00:00:00.000Z" },
      { id: "pin-b", title: "Pin B", created_at: "2026-01-01T00:00:00.000Z", class_updated_at: "2026-01-02T00:00:00.000Z" },
    ],
    getLastOpened: async () => "last",
    getPinned: async () => ["pin-a", "pin-b"],
    listCommunity: async () => [{ id: "c-1", title: "Community 1", created_at: "2026-01-05T00:00:00.000Z" }],
  });

  assert.deepEqual(
    feed.map((item) => item.id),
    ["last", "pin-a", "pin-b", "recent", "c-1"],
  );
});

test("limits output and remains stable when sources fail", async () => {
  const feed = await buildLabsShowcaseFeed("user-1", {
    listBoards: async () => {
      throw new Error("boom");
    },
    getLastOpened: async () => null,
    getPinned: async () => [],
    listCommunity: async () =>
      Array.from({ length: 5 }, (_, index) => ({
        id: `c-${index + 1}`,
        title: `Community ${index + 1}`,
        created_at: `2026-01-0${index + 1}T00:00:00.000Z`,
      })),
  });

  assert.equal(feed.length, 3);
  assert.deepEqual(
    feed.map((item) => item.id),
    ["c-1", "c-2", "c-3"],
  );
});
