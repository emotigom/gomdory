import assert from "node:assert/strict";
import test from "node:test";

import { computeSectionScrollTop } from "@/lib/board/scrollToSection";

test("scrollToSection math centers target section", () => {
  const top = computeSectionScrollTop({
    containerTop: 100,
    containerHeight: 500,
    currentScrollTop: 200,
    targetTop: 520,
    targetHeight: 100,
    align: "center",
    offsetTop: 0,
    maxScrollTop: 1200,
  });

  assert.equal(top, 420);
});

test("scrollToSection math respects offset and clamps", () => {
  const top = computeSectionScrollTop({
    containerTop: 80,
    containerHeight: 400,
    currentScrollTop: 100,
    targetTop: 90,
    targetHeight: 120,
    align: "start",
    offsetTop: 24,
    maxScrollTop: 600,
  });

  assert.equal(top, 86);
});
