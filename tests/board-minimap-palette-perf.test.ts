import assert from "node:assert/strict";
import test from "node:test";

import { shouldRedrawMinimapFromMutations } from "@/lib/ui/minimap";
import { createRafCoalescer } from "@/lib/ui/rafCoalescer";
import { buildCardJumpPaletteItems, shouldBuildCardJumpList } from "@/lib/ui/paletteJump";

test("rAF coalescer prevents duplicate draws in a single frame", () => {
  const queued: Array<() => void> = [];
  let drawCount = 0;
  let nextHandle = 1;
  const coalescer = createRafCoalescer(
    () => {
      drawCount += 1;
    },
    (cb) => {
      queued.push(() => cb(0));
      return nextHandle++;
    },
  );

  assert.equal(coalescer.schedule(), true);
  assert.equal(coalescer.schedule(), false);
  assert.equal(queued.length, 1);

  queued[0]?.();
  assert.equal(drawCount, 1);
});

test("minimap mutation predicate only responds to card/column structure changes", () => {
  assert.equal(
    shouldRedrawMinimapFromMutations([
      {
        type: "attributes",
        targetDataset: { scroll: "wall-column", wallId: "w1" },
      },
      {
        type: "childList",
        targetDataset: { random: "node" },
        addedDatasets: [{ random: "child" }],
      },
    ]),
    false,
  );

  assert.equal(
    shouldRedrawMinimapFromMutations([
      {
        type: "childList",
        targetDataset: { scroll: "wall-column", wallId: "w1" },
        addedDatasets: [{ cardId: "c1" }],
      },
    ]),
    true,
  );
});

test("palette jump card list builder dedupes ids and supports lazy-build gating", () => {
  const cache = new Map<string, string>();
  const items = buildCardJumpPaletteItems(
    [
      { id: "c1", text: "첫 카드\n본문" },
      { id: "c1", text: "중복 카드\n본문" },
      { id: "c2", text: "둘째 카드" },
    ],
    cache,
  );

  assert.deepEqual(items, [
    { id: "c1", title: "첫 카드" },
    { id: "c2", title: "둘째 카드" },
  ]);
  assert.equal(cache.get("c1"), "첫 카드");

  assert.equal(shouldBuildCardJumpList({ isPaletteOpen: false, hasBuilt: false, isDirty: true }), false);
  assert.equal(shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: false, isDirty: false }), true);
  assert.equal(shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: true, isDirty: false }), false);
  assert.equal(shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: true, isDirty: true }), true);
});
