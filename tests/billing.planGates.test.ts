import assert from "node:assert/strict";
import test from "node:test";

import { getUserPlan } from "@/lib/billing/getUserPlan";
import { assertPro, ProRequiredError } from "@/lib/billing/planGates";
import type { UserPlan } from "@/lib/types/billing";

test("getUserPlan treats expired pro as free", async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const plan = await getUserPlan({
    userId: "user-1",
    now: new Date(),
    createSupabaseAdminClientFn: () =>
      ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { plan: "pro", expires_at: past, note: "" }, error: null }),
            }),
          }),
        }),
      }) as never,
  });

  assert.equal(plan.plan, "free");
  assert.equal(plan.isPro, false);
});

test("assertPro throws for free plans", () => {
  assert.throws(
    () => assertPro({ plan: "free", isPro: false } as UserPlan),
    (error) => error instanceof ProRequiredError,
  );
});
