import assert from "node:assert/strict";
import test from "node:test";

import { GET as getPublicShowcase } from "@/app/api/v1/public/showcases/[token]/route";
import { GET as getLegacyShowcase } from "@/app/api/v1/showcase/[token]/route";
import { POST as rotateShowcaseToken } from "@/app/api/v1/showcases/[showcaseId]/rotate-token/route";

import type { ShowcaseSnapshot } from "@/lib/showcase/buildShowcaseSnapshot";

test("rotate token invalidates previous token", async () => {
  const showcaseId = "showcase-1";
  const snapshot: ShowcaseSnapshot = {
    version: 1,
    boardId: "board-1",
    generatedAt: new Date().toISOString(),
    headline: "오늘의 수업 결과",
    metrics: { participants: 1, questionsCount: 2, helpRequests: 0, pollsCount: 1 },
    highlights: [],
    gallery: [],
  };

  const showcases = new Map([
    [showcaseId, { id: showcaseId, owner_id: "user-1", is_revoked: false, snapshot }],
  ]);
  const tokens = new Map([
    ["old-token", { token: "old-token", showcase_id: showcaseId, revoked_at: null, last_accessed_at: null }],
  ]);

  const admin = {
    from: (table: string) => {
      if (table === "showcases") {
        return {
          select: () => ({
            eq: (_field: string, value: string) => ({
              maybeSingle: async () => ({
                data: showcases.get(value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "showcase_tokens") {
        return {
          select: () => ({
            eq: (_field: string, value: string) => ({
              maybeSingle: async () => ({
                data: tokens.get(value) ?? null,
                error: null,
              }),
            }),
          }),
          update: (values: Record<string, unknown>) => ({
            eq: async (field: string, value: string) => {
              if (field === "showcase_id") {
                for (const entry of tokens.values()) {
                  if (entry.showcase_id === value) {
                    entry.revoked_at = values.revoked_at as string;
                  }
                }
              }
              if (field === "token") {
                const entry = tokens.get(value);
                if (entry) {
                  entry.last_accessed_at = values.last_accessed_at as string;
                }
              }
              return { error: null };
            },
          }),
          insert: async (values: { token: string; showcase_id: string }) => {
            tokens.set(values.token, {
              token: values.token,
              showcase_id: values.showcase_id,
              revoked_at: null,
              last_accessed_at: null,
            });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as const;

  const rotateResponse = await rotateShowcaseToken(
    new Request("http://www.gomdory.com/api/v1/showcases/showcase-1/rotate-token", {
      method: "POST",
      headers: { host: "www.gomdory.com" },
    }),
    { params: Promise.resolve({ showcaseId }) },
    {
      createSupabaseAdminClientFn: () => admin as never,
      createShowcaseTokenFn: () => "new-token",
      requireUserApiFn: async () => ({ user: { id: "user-1" } }) as never,
    },
  );

  assert.equal(rotateResponse.status, 200);
  const rotatePayload = (await rotateResponse.json()) as { token?: string };
  assert.equal(rotatePayload.token, "new-token");

  const oldTokenResponse = await getPublicShowcase(
    new Request("http://localhost/api/v1/public/showcases/old-token"),
    { params: Promise.resolve({ token: "old-token" }) },
    { createSupabaseAdminClientFn: () => admin as never },
  );

  assert.equal(oldTokenResponse.status, 404);

  const newTokenResponse = await getPublicShowcase(
    new Request("http://localhost/api/v1/public/showcases/new-token"),
    { params: Promise.resolve({ token: "new-token" }) },
    { createSupabaseAdminClientFn: () => admin as never },
  );

  assert.equal(newTokenResponse.status, 200);
  const newTokenPayload = (await newTokenResponse.json()) as { requestId?: string; headline?: string };
  assert.equal(newTokenPayload.headline, snapshot.headline);
  assert.ok(newTokenPayload.requestId);
  assert.equal(newTokenResponse.headers.get("x-request-id"), newTokenPayload.requestId);
  assert.equal(newTokenResponse.headers.get("cache-control"), "public, max-age=60");
});

test("legacy showcase token route keeps canonical request context headers", async () => {
  const snapshot: ShowcaseSnapshot = {
    version: 1,
    boardId: "board-legacy",
    generatedAt: new Date().toISOString(),
    headline: "Legacy showcase",
    metrics: { participants: 1, questionsCount: 2, helpRequests: 0, pollsCount: 1 },
    highlights: [],
    gallery: [],
  };

  const admin = {
    from: (table: string) => {
      if (table === "showcase_tokens") {
        return {
          select: () => ({
            eq: (_field: string, value: string) => ({
              maybeSingle: async () => ({
                data:
                  value === "legacy-token"
                    ? { token: "legacy-token", showcase_id: "legacy-showcase", revoked_at: null }
                    : null,
                error: null,
              }),
            }),
          }),
          update: (_values: Record<string, unknown>) => ({
            eq: async (_field: string, _value: string) => ({ error: null }),
          }),
        };
      }

      if (table === "showcases") {
        return {
          select: () => ({
            eq: (_field: string, value: string) => ({
              maybeSingle: async () => ({
                data:
                  value === "legacy-showcase"
                    ? { snapshot, is_revoked: false }
                    : null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  const response = await getLegacyShowcase(
    new Request("http://localhost/api/v1/showcase/legacy-token"),
    { params: Promise.resolve({ token: "legacy-token" }) },
    { createSupabaseAdminClientFn: () => admin as never },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { requestId?: string; headline?: string };
  assert.equal(payload.headline, snapshot.headline);
  assert.ok(payload.requestId);
  assert.equal(response.headers.get("x-request-id"), payload.requestId);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
});
