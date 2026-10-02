import assert from "node:assert/strict";
import test from "node:test";

import { POST as installTemplate } from "@/app/api/v1/templates/[id]/install/route";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { UserPlan } from "@/lib/types/billing";

const basePayload: SanitizedTemplatePayload = {
  meta: { payloadVersion: 1, generatedAt: new Date().toISOString() },
  board: {
    title: "보드",
    description: null,
    boardViewType: "grid",
    theme: null,
    layout: null,
    viewDefaults: null,
  },
  walls: [{ title: "담벼락", description: null, position: 1 }],
  cards: [],
};

type TemplateRow = {
  template_id: string;
  owner_user_id: string;
  visibility: "public" | "unlisted" | "hidden";
  pro_only: boolean;
  stats: Record<string, unknown> | null;
  payload: SanitizedTemplatePayload | null;
  moderation: Record<string, unknown> | null;
};

function createMockSupabase(template: TemplateRow, proPackItems: unknown[] = []) {
  return {
    from: (table: string) => {
      if (table === "templates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: template, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === "template_collection_items") {
        const chain = {
          eq: () => chain,
          limit: async () => ({ data: proPackItems, error: null }),
        };
        return {
          select: () => chain,
        };
      }

      if (table === "template_collections") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test("pro pack imports return 403 without entitlement", async () => {
  const response = await installTemplate(
    new Request("http://localhost/api/v1/templates/template-1/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "pro_pack" }),
    }),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "free@example.com" } }),
      createSupabaseAdminClientFn: () =>
        createMockSupabase({
          template_id: "t1",
          owner_user_id: "user-1",
          visibility: "public",
          stats: { clones: 0 },
          payload: basePayload,
          pro_only: false,
          moderation: {},
        }) as never,
      getUserPlanFn: async () => ({ plan: "free", isPro: false } as UserPlan),
      getEntitlementsFn: async () => ({ proTemplates: false }),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(payload.error?.code, "pro_locked");
});

test("community imports succeed without pro pack entitlements", async () => {
  const response = await installTemplate(
    new Request("http://localhost/api/v1/templates/template-1/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "community" }),
    }),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-2", email: "teacher@example.com" } }),
      createSupabaseAdminClientFn: () =>
        createMockSupabase(
          {
            template_id: "t1",
            owner_user_id: "user-2",
            visibility: "public",
            stats: { clones: 0 },
            payload: basePayload,
            pro_only: false,
            moderation: {},
          },
          [],
        ) as never,
      createBoardFromTemplatePayloadFn: async () => "board-free-1",
      getUserPlanFn: async () => ({ plan: "free", isPro: false } as UserPlan),
      getEntitlementsFn: async () => ({ proTemplates: false }),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; boardId?: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.boardId, "board-free-1");
});
