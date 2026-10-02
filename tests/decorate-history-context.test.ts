import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateHistoryContext } from "@/lib/edu/lesson/decorateHistoryContext";

test("builds history context from apply/undo/user edit summaries", () => {
  const ctx = buildDecorateHistoryContext({
    recentUserEditSummary: { hasEdits: true, regionKinds: ["heading"], attributeKinds: ["color"], ageMs: 1200 },
    recentDecorateEvents: [
      { intent: "tone", tone: ["cute"], applied: true, source: "server_llm" },
      { intent: "color", colors: ["pink"], weakChange: true, undoneAfterApply: true, source: "deterministic" },
    ],
    currentHtmlHash: "h1",
  });
  assert.equal(ctx.avoidConflictWithRecentUserEdit, true);
  assert.equal(ctx.avoidRepeatingWeakChanges, true);
  assert.ok(ctx.recentToneBias.includes("cute"));
  assert.ok(ctx.recentColorBias.includes("pink"));
  assert.ok(ctx.historyConfidence >= 0.3);
});
