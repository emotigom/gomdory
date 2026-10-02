import assert from "node:assert/strict";
import test from "node:test";

import { GET as publicExhibitGet } from "@/app/api/v1/public/exhibits/[token]/route";
import type { ExhibitPayload } from "@/lib/exhibit/types";

const payload: ExhibitPayload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  board: { title: "전시", layout: "gallery", counts: { cards: 4, columns: 2 } },
  highlights: [],
  aggregates: { questionsCount: 1, helpCount: 2 },
  timeline: [],
  notes: {},
};

test("public exhibit returns payload for active exhibit", async () => {
  const response = await publicExhibitGet(
    new Request("http://localhost/api/v1/public/exhibits/token"),
    { params: Promise.resolve({ token: "token" }) },
    {
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "exhibits") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: "ex-1", status: "active" },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "exhibit_versions") {
              return {
                select: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: { payload },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
            throw new Error("unexpected table");
          },
        }) as never,
    },
  );

  assert.equal(response.status, 200);
  const json = (await response.json()) as ExhibitPayload;
  assert.equal(json.board.title, "전시");
});

test("public exhibit returns 404 for revoked exhibit", async () => {
  const response = await publicExhibitGet(
    new Request("http://localhost/api/v1/public/exhibits/token"),
    { params: Promise.resolve({ token: "token" }) },
    {
      createSupabaseAdminClientFn: () =>
        ({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "ex-1", status: "revoked" },
                  error: null,
                }),
              }),
            }),
          }),
        }) as never,
    },
  );

  assert.equal(response.status, 404);
});
