import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as boardsGet } from "@/app/api/v1/dashboard/boards/route";
import { requireUser } from "@/lib/auth/requireUser";
import type { SupabaseClient } from "@supabase/supabase-js";

test("boards API returns 401 when unauthenticated", async () => {
  const previousEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  process.env.SUPABASE_URL = "https://example.com";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

  const response = await boardsGet(
    new NextRequest(new Request("http://localhost/api/v1/dashboard/boards")),
    undefined,
    {
      createSupabaseServerClientFn: () =>
        ({
          auth: {},
        }) as ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>,
      getUserFn: async () => ({ user: null, error: "unauthorized" }),
      validateSupabaseEnvFn: () => ({
        ok: true,
        supabaseUrl: "https://example.com",
        supabaseAnonKey: "anon",
        serviceRoleKey: undefined,
      }),
    },
  );

  const body = (await response.json()) as { ok?: boolean; code?: string; error?: { code?: string } };

  try {
    assert.equal(response.status, 401);
    assert.equal(body.error?.code, "UNAUTHENTICATED");
    assert.equal(body.ok, false);
  } finally {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
});

test("dashboard route redirects to login when there is no session", async () => {
  const supabaseStub = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    },
  } as unknown as Pick<SupabaseClient, "auth">;

  await assert.rejects(
    () =>
      requireUser("/dashboard", {
        supabaseFactory: () => supabaseStub,
        redirectImpl: (url: string) => {
          throw new Error(`REDIRECT:${url}`);
        },
        validateEnv: () => ({
          ok: true,
          supabaseUrl: "https://example.com",
          supabaseAnonKey: "anon",
          serviceRoleKey: undefined,
        }),
      }),
    /REDIRECT:\/auth\/login\?returnTo=%2Fdashboard/,
  );
});
