import assert from "node:assert/strict";
import test from "node:test";

import { POST as copyTemplate } from "@/app/api/v1/templates/[id]/copy/route";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";

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

test("copy API blocks pro templates when unlock is off", async () => {
  const prev = process.env.NEXT_PUBLIC_PRO_UNLOCK_MODE;
  process.env.NEXT_PUBLIC_PRO_UNLOCK_MODE = "off";

  const response = await copyTemplate(
    new Request("http://localhost/api/v1/templates/template-1/copy", { method: "POST" }),
    { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "free@example.com" } }),
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
                        tier: "pro",
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
            if (table === "template_collections") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
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
    },
  );

  const payload = (await response.json()) as { ok?: boolean; code?: string };
  assert.equal(response.status, 402);
  assert.equal(payload.code, "pro_required");

  process.env.NEXT_PUBLIC_PRO_UNLOCK_MODE = prev;
});
