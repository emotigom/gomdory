import assert from "node:assert/strict";
import test from "node:test";

import { POST as reportPost } from "@/app/api/v1/public/report/route";
import { checkRateLimit } from "@/lib/safety/rateLimit";

test("public report auto-hides after threshold", async () => {
  let hideUpserted = false;
  let cardHidden = false;

  const adminClient = {
    from: (table: string) => {
      if (table === "reports") {
        return {
          insert: async () => ({ error: null }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ count: 3, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "moderation_hides") {
        return {
          upsert: async () => {
            hideUpserted = true;
            return { error: null };
          },
        };
      }
      if (table === "cards") {
        return {
          update: () => ({
            eq: async () => {
              cardHidden = true;
              return { error: null };
            },
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  } as const;

  const request = new Request("http://localhost/api/v1/public/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetType: "card",
      targetId: "card-1",
      code: "abc234",
      reason: "spam",
      detail: "스팸 같아요",
      anonId: "anon-1",
    }),
  });

  const response = await reportPost(request, undefined, {
    createSupabaseAdminClientFn: () => adminClient as never,
    getBoardByShareCodeFn: async () => ({ id: "board-1" }) as never,
    rateLimitDb: createRateLimitDb(),
    checkRateLimitFn: checkRateLimit,
    recordAuditEventFn: async () => {},
    nowFn: () => 1700000000000,
  });

  const payload = (await response.json()) as { hidden?: boolean };
  assert.equal(response.status, 200);
  assert.equal(payload.hidden, true);
  assert.equal(hideUpserted, true);
  assert.equal(cardHidden, true);
});

test("public report returns standardized error payload", async () => {
  const request = new Request("http://localhost/api/v1/public/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType: "card", targetId: "card-1", reason: "invalid" }),
  });

  const response = await reportPost(request, undefined, {
    createSupabaseAdminClientFn: () => ({ from: () => ({}) }) as never,
    rateLimitDb: createRateLimitDb(),
    checkRateLimitFn: checkRateLimit,
    recordAuditEventFn: async () => {},
    nowFn: () => 1700000000000,
  });

  const payload = (await response.json()) as { ok?: boolean; error?: { code?: string } };
  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error?.code, "invalid_reason");
});

function createRateLimitDb() {
  const buckets = new Map<string, number>();
  return {
    rpc: async (_fn: string, params: Record<string, unknown>) => {
      const key = `${params.p_key}:${params.p_window_start}`;
      const next = (buckets.get(key) ?? 0) + 1;
      buckets.set(key, next);
      return { data: next, error: null };
    },
  };
}
