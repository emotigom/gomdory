import assert from "node:assert/strict";
import test from "node:test";

import { compileBlocksToIr } from "@/lib/coding-studio/ir";

test("compileBlocksToIr compiles starter blocks including nested repeat", () => {
  const ir = compileBlocksToIr([
    { id: "start", type: "start" },
    { id: "move", type: "move", params: { distance: 2 } },
    {
      id: "repeat",
      type: "repeat",
      params: { count: 2 },
      children: [{ id: "turn", type: "turn", params: { degrees: 90 } }],
    },
  ]);

  assert.equal(ir.length, 2);
  assert.deepEqual(ir[0], { kind: "move", distance: 2 });
  assert.equal(ir[1]?.kind, "repeat");
});
