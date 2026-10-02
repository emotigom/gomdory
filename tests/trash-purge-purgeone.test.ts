import assert from "node:assert/strict";
import test from "node:test";

import { purgeOne } from "@/lib/ops/trashPurge.server";

function createAdminDeleteStub() {
  return {
    from() {
      return {
        delete() {
          return this;
        },
        eq() {
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

test("purgeOne does not throw on missing R2", async () => {
  const result = await purgeOne(
    { type: "file", id: "f1", storageKey: "missing-key" },
    {
      createAdminClientFn: (() => createAdminDeleteStub()) as never,
      deleteObjectFn: async () => {
        throw new Error("missing");
      },
      logAuditFn: async () => {},
    },
  );

  assert.equal(result.ok, true);
});
