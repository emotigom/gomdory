import assert from "node:assert/strict";
import test from "node:test";

import { GET as listTemplates } from "@/app/api/v1/templates/route";
import { makeMockUser } from "@/tests/helpers/mockUser";

test("templates list filters public visibility", async () => {
  const filters: Array<{ field: string; value: unknown }> = [];
  let guardedAutoHidden = false;
  const builder = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      filters.push({ field, value });
      return builder;
    },
    in: (field: string, value: unknown) => {
      filters.push({ field, value });
      return builder;
    },
    contains: () => builder,
    or: (clause?: string) => {
      if (typeof clause === "string" && clause.includes("autoHidden")) {
        guardedAutoHidden = true;
      }
      return builder;
    },
    order: () => builder,
    limit: async () => ({ data: [], error: null }),
  };

  const response = await listTemplates(new Request("http://localhost/api/v1/templates"), undefined, {
    requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-1" }) }),
    createSupabaseAdminClientFn: () => ({
      from: () => builder,
    }) as never,
  });

  assert.equal(response.status, 200);
  assert.ok(filters.some((filter) => filter.field === "visibility" && Array.isArray(filter.value)));
  assert.ok(filters.some((filter) => filter.field === "status" && filter.value === "active"));
  assert.equal(guardedAutoHidden, true);
});

test("templates list scope=mine filters by owner", async () => {
  const filters: Array<{ field: string; value: unknown }> = [];
  const builder = {
    select: () => builder,
    eq: (field: string, value: unknown) => {
      filters.push({ field, value });
      return builder;
    },
    contains: () => builder,
    or: () => builder,
    order: () => builder,
    limit: async () => ({ data: [], error: null }),
  };

  const response = await listTemplates(new Request("http://localhost/api/v1/templates?scope=mine"), undefined, {
    requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-1" }) }),
    createSupabaseAdminClientFn: () => ({
      from: () => builder,
    }) as never,
  });

  assert.equal(response.status, 200);
  assert.ok(filters.some((filter) => filter.field === "owner_user_id" && filter.value === "user-1"));
  assert.equal(filters.some((filter) => filter.field === "visibility"), false);
});
