import assert from "node:assert/strict";
import test from "node:test";

import { POST as installTemplate } from "@/app/api/v1/templates/[id]/install/route";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { UserPlan } from "@/lib/types/billing";
import { makeMockUser } from "@/tests/helpers/mockUser";

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

test("install API blocks pro templates for free users", async () => {
  const response = await installTemplate(
    new Request("http://localhost/api/v1/templates/template-1/install", { method: "POST" }),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-1", email: "free@example.com" }) }),
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "templates") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        template_id: "t1",
                        owner_user_id: "user-1",
                        visibility: "public",
                        stats: { clones: 0 },
                        payload: basePayload,
                        pro_only: true,
                        moderation: {},
                      },
                      error: null,
                    }),
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
                limit: async () => ({ data: [], error: null }),
              };
              return { select: () => chain };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        }) as never,
      getUserPlanFn: async () => ({ plan: "free", isPro: false } as UserPlan),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; code?: string };
  assert.equal(response.status, 402);
  assert.equal(payload.code, "pro_required");
});

test("install API allows pro templates for allowlisted users", async () => {
  let updateCalled = false;

  const response = await installTemplate(
    new Request("http://localhost/api/v1/templates/template-1/install", { method: "POST" }),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-2", email: "pro@example.com" }) }),
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "templates") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        template_id: "t1",
                        owner_user_id: "user-2",
                        visibility: "public",
                        stats: { clones: 0 },
                        payload: basePayload,
                        pro_only: true,
                        moderation: {},
                      },
                      error: null,
                    }),
                  }),
                }),
                update: () => ({
                  eq: async () => {
                    updateCalled = true;
                    return { data: [], error: null };
                  },
                }),
              };
            }
            if (table === "template_collection_items") {
              const chain = {
                eq: () => chain,
                limit: async () => ({ data: [], error: null }),
              };
              return { select: () => chain };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        }) as never,
      createBoardFromTemplatePayloadFn: async () => "board-pro-1",
      getUserPlanFn: async () => ({ plan: "pro", isPro: true } as UserPlan),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; boardId?: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.boardId, "board-pro-1");
  assert.equal(updateCalled, true);
});
