import assert from "node:assert/strict";
import test from "node:test";

import { createVisibilityRefetchController } from "@/lib/dashboard/useVisibilityRefetch";
import { shouldThrottleRefetch } from "@/app/dashboard/useDashboardBoards";

test("visibility refetch controller defers while hidden and flushes on focus", () => {
  let refetchCount = 0;
  let visibility: "hidden" | "visible" = "hidden";

  const controller = createVisibilityRefetchController({
    refetch: () => {
      refetchCount += 1;
    },
    getVisibilityState: () => visibility,
    isOnline: () => true,
  });

  controller.requestRefetch();
  assert.equal(refetchCount, 0);
  assert.equal(controller.isPending(), true);

  visibility = "visible";
  controller.handleFocus();
  assert.equal(refetchCount, 1);
  assert.equal(controller.isPending(), false);
});

test("refetch throttle blocks rapid calls", () => {
  const now = 10_000;
  assert.equal(shouldThrottleRefetch(now - 1000, now), true);
  assert.equal(shouldThrottleRefetch(now - 3000, now), false);
});
