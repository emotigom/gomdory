import assert from "node:assert/strict";
import test from "node:test";

import { runTrashPurge } from "@/lib/ops/trashPurge.server";

type TableName = "boards" | "cards" | "board_files" | "files";

function createAdminStub(dataByTable: Record<TableName, unknown[]>) {
  return {
    from(table: TableName) {
      return {
        select() {
          return this;
        },
        not() {
          return this;
        },
        lte() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: dataByTable[table], error: null });
        },
      };
    },
  };
}

test("dryRun returns expected candidates", async () => {
  const admin = createAdminStub({
    boards: [{ id: "b1", deleted_at: "2026-01-01T00:00:00.000Z", deleted_purge_at: "2026-01-31T00:00:00.000Z" }],
    cards: [{ id: "c1", deleted_at: "2026-01-02T00:00:00.000Z", deleted_purge_at: "2026-02-01T00:00:00.000Z" }],
    board_files: [{ id: "bf1", deleted_at: "2026-01-03T00:00:00.000Z", deleted_purge_at: "2026-02-02T00:00:00.000Z", r2_key: "k1" }],
    files: [{ id: "f1", deleted_at: "2026-01-04T00:00:00.000Z", deleted_purge_at: "2026-02-03T00:00:00.000Z", r2_key: "k2" }],
  });

  const summary = await runTrashPurge(
    { dryRun: true, now: new Date("2026-12-31T00:00:00.000Z") },
    {
      requireOpsAdminFn: async () => ({ user: { id: "u1", email: "ops@example.com" } }),
      createAdminClientFn: (() => admin) as never,
    },
  );

  assert.deepEqual(summary, {
    dryRun: true,
    scanned: 4,
    purged: 0,
    failed: 0,
  });
});
