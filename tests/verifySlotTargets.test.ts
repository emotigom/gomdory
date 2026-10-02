import assert from "node:assert/strict";
import test from "node:test";

import { verifySlotTargets } from "@/lib/edu/slots/verifySlotTargets";

test("verifySlotTargets returns true when P1 slot target exists", () => {
  const result = verifySlotTargets({
    pageKey: "P1",
    slot: "keywords",
    files: {
      "index.html": '<html><body><h1 data-slot="p1.keywords">#여유</h1></body></html>',
    },
  });

  assert.equal(result.ok, true);
});

test("verifySlotTargets returns false when data-slot target is missing", () => {
  const result = verifySlotTargets({
    pageKey: "P2",
    slot: "p2.topic",
    files: {
      "index.html": "<html><body><h1>hello</h1></body></html>",
    },
  });

  assert.equal(result.ok, false);
});
