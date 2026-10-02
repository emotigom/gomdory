import assert from "node:assert/strict";
import test from "node:test";

import { POST as createShowcaseTemplate } from "@/app/api/v1/showcase/[token]/template/route";
import type { SanitizedTemplatePayload } from "@/lib/templates/sanitizeTemplatePayload";
import type { ShowcaseSummary } from "@/lib/showcase/buildShowcaseSummary";

const payload: SanitizedTemplatePayload = {
  meta: { payloadVersion: 1, generatedAt: new Date().toISOString() },
  board: {
    title: "보드",
    description: null,
    boardViewType: "wall",
    theme: null,
    layout: null,
    viewDefaults: null,
  },
  walls: [{ title: "요약", description: null, position: 1 }],
  cards: [],
};

const showcaseSummary: ShowcaseSummary = {
  version: 1,
  generatedAt: new Date().toISOString(),
  board: { title: "수업" },
  stats: { questionsCount: 0, helpCount: 0, pollsCount: 0, participantsApprox: null },
  highlights: [],
  topQuestions: [],
  teacherNotes: null,
};

test("showcase template API blocks non-owner", async () => {
  const response = await createShowcaseTemplate(
    new Request("http://localhost/api/v1/showcase/token/template", {
      method: "POST",
      body: JSON.stringify({ title: "템플릿" }),
    }),
    { params: Promise.resolve({ token: "token" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-2" } }),
      showcaseToTemplateFn: () => payload,
      buildShowcaseSummaryFn: async () => showcaseSummary,
      createSupabaseAdminClientFn: () => ({
        from: (table: string) => {
          if (table === "showcase_tokens") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { token: "token", showcase_id: "show-1", revoked_at: null },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "showcases") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "show-1",
                      owner_id: "user-1",
                      is_revoked: false,
                      board_id: "board-1",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      }) as never,
    },
  );

  assert.equal(response.status, 403);
});

test("showcase template API stores community visibility", async () => {
  let inserted: Record<string, unknown> | null = null;

  const response = await createShowcaseTemplate(
    new Request("http://localhost/api/v1/showcase/token/template", {
      method: "POST",
      body: JSON.stringify({ visibility: "community" }),
    }),
    { params: Promise.resolve({ token: "token" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1" } }),
      showcaseToTemplateFn: () => payload,
      buildShowcaseSummaryFn: async () => showcaseSummary,
      createSupabaseAdminClientFn: () => ({
        from: (table: string) => {
          if (table === "showcase_tokens") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      token: "token",
                      showcase_id: "show-1",
                      revoked_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "showcases") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "show-1",
                      owner_id: "user-1",
                      is_revoked: false,
                      board_id: "board-1",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "templates") {
            return {
              insert: (values: Record<string, unknown>) => {
                inserted = values;
                return {
                  select: () => ({
                    single: async () => ({ data: { template_id: "template-1" }, error: null }),
                  }),
                };
              },
            };
          }
          throw new Error("unexpected table");
        },
      }) as never,
    },
  );

  const json = (await response.json()) as { ok?: boolean; templateId?: string };
  assert.equal(json.ok, true);
  assert.equal(json.templateId, "template-1");
  assert.ok(inserted);
  assert.equal(inserted?.visibility, "public");
});
