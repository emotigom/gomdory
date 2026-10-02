import assert from "node:assert/strict";
import test from "node:test";

import { getActiveBanner } from "@/lib/ops/banners.server";

function createAdminStub(rows: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  };
}

test("banner is active only within startsAt/endsAt window", async () => {
  const now = Date.now();
  const stub = createAdminStub([
    {
      message: "예약 배너",
      href: null,
      label: null,
      level: "info",
      enabled: true,
      starts_at: new Date(now + 60_000).toISOString(),
      ends_at: new Date(now + 120_000).toISOString(),
    },
    {
      message: "활성 배너",
      href: "/dashboard",
      label: "자세히",
      level: "warning",
      enabled: true,
      starts_at: new Date(now - 60_000).toISOString(),
      ends_at: new Date(now + 60_000).toISOString(),
    },
  ]);

  const banner = await getActiveBanner(() => stub as never, now);
  assert.equal(banner?.message, "활성 배너");
  assert.equal(banner?.level, "warning");
});
