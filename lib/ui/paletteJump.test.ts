import assert from "node:assert/strict";
import test from "node:test";

import { buildCardJumpPaletteItems, shouldBuildCardJumpList } from "@/lib/ui/paletteJump";

test("buildCardJumpPaletteItems dedupes by card id and caches computed title", () => {
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
});

test("shouldBuildCardJumpList runs lazily only when palette is open", () => {
  assert.equal(
    shouldBuildCardJumpList({ isPaletteOpen: false, hasBuilt: false, isDirty: true }),
    false,
  );
  assert.equal(
    shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: false, isDirty: false }),
    true,
  );
  assert.equal(
    shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: true, isDirty: false }),
    false,
  );
  assert.equal(
    shouldBuildCardJumpList({ isPaletteOpen: true, hasBuilt: true, isDirty: true }),
    true,
  );
});
