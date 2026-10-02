import assert from "node:assert/strict";
import test from "node:test";

import { removeOptimisticAttachmentById } from "@/lib/cards/optimisticAttachments";

test("removeOptimisticAttachmentById removes target and tracks removed metadata", () => {
  const items = [
    { id: "file-1", type: "file" as const, url: "https://cdn.example.com/a" },
    { id: "card-1-ext-0", type: "url" as const, url: "https://one.example.com" },
  ];

  const result = removeOptimisticAttachmentById(items, "card-1-ext-0");

  assert.equal(result.next.length, 1);
  assert.equal(result.next[0]?.id, "file-1");
  assert.equal(result.removed?.id, "card-1-ext-0");
  assert.equal(result.removedIndex, 1);
});

test("removeOptimisticAttachmentById is a no-op when id does not exist", () => {
  const items = [{ id: "file-1", type: "file" as const, url: "https://cdn.example.com/a" }];

  const result = removeOptimisticAttachmentById(items, "missing");

  assert.deepEqual(result.next, items);
  assert.equal(result.removed, null);
  assert.equal(result.removedIndex, -1);
});
