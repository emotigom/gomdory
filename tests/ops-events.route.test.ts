import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as opsEventsGet } from "@/app/api/v1/ops/events/route";

test("ops events API is owner only", async () => {
  const response = await opsEventsGet(
    new NextRequest(new Request("http://localhost/api/v1/ops/events")),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { email: "teacher@example.com" } }),
      isOpsOwnerFn: () => false,
    },
  );

  assert.equal(response.status, 404);
});

test("ops events API returns events for owners", async () => {
  const mockQuery = {
    select: () => mockQuery,
    order: () => mockQuery,
    limit: () => mockQuery,
    eq: () => mockQuery,
    lt: () => mockQuery,
    gte: () => mockQuery,
    then: (
      resolve: (value: { data: unknown[]; error: null }) => void,
      reject: (reason?: unknown) => void,
    ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  const mockClient = {
    from: () => mockQuery,
  };

  const response = await opsEventsGet(
    new NextRequest(new Request("http://localhost/api/v1/ops/events")),
    undefined,
    {
      requireUserApiFn: async () => ({ user: { email: "owner@example.com" } }),
      isOpsOwnerFn: () => true,
      createAdminClientFn: () => mockClient,
    },
  );

  const body = (await response.json()) as { ok?: boolean; events?: unknown[] };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.events, []);
});
