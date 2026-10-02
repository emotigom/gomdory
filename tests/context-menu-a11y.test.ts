import assert from "node:assert/strict";
import test from "node:test";

import { handleContextMenuKeydown } from "@/app/_components/context-menu-a11y";

test("context menu ESC closes menu and restores focus", () => {
  let closeCalls = 0;
  let restoreCalls = 0;
  let prevented = 0;

  handleContextMenuKeydown({
    key: "Escape",
    itemCount: 3,
    activeIndex: 1,
    onActiveIndexChange: () => {
      throw new Error("active index should not change on Escape");
    },
    onClose: () => {
      closeCalls += 1;
    },
    onRestoreFocus: () => {
      restoreCalls += 1;
    },
    preventDefault: () => {
      prevented += 1;
    },
  });

  assert.equal(closeCalls, 1);
  assert.equal(restoreCalls, 1);
  assert.equal(prevented, 1);
});

test("context menu ArrowDown moves focus index", () => {
  const seen: number[] = [];

  handleContextMenuKeydown({
    key: "ArrowDown",
    itemCount: 3,
    activeIndex: 1,
    onActiveIndexChange: (index) => {
      seen.push(index);
    },
    onClose: () => {
      throw new Error("close should not be called on ArrowDown");
    },
    onRestoreFocus: () => {
      throw new Error("restore should not be called on ArrowDown");
    },
    preventDefault: () => undefined,
  });

  assert.deepEqual(seen, [2]);
});
