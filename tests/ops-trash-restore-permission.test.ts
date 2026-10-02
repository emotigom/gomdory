import assert from "node:assert/strict";
import test from "node:test";

import { restoreTrashItem } from "@/app/dashboard/ops/trash/actions";

test("restore trash requires ops-admin", async () => {
  const result = await restoreTrashItem(
    { tab: "boards", id: "b1" },
    {
      requireUserFn: async () => ({ user: { id: "u1", email: "teacher@example.com" } }) as never,
      isOpsAdminFn: () => false,
      createSupabaseAdminClientFn: (() => {
        throw new Error("should_not_run");
      }) as never,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "ops_only");
});
