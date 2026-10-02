import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createSupabaseAdminFetch,
} from "@/lib/supabase/adminFetch";

type SeenRequest = {
  headers: Headers;
};

function createRecordingFetch() {
  const seen: SeenRequest[] = [];
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ headers: new Headers(init?.headers) });
    return new Response(null, { status: 204 });
  };
  return { fetcher, seen };
}

test("modern secret strips only the duplicate Bearer value and preserves apikey", async () => {
  const key = "sb_secret_example";
  const { fetcher, seen } = createRecordingFetch();
  const adminFetch = createSupabaseAdminFetch(key, fetcher);

  await adminFetch("https://example.invalid/rest/v1/private", {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "X-Client-Info": "supabase-js-node/test",
    },
  });

  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.headers.get("apikey"), key);
  assert.equal(seen[0]!.headers.get("authorization"), null);
  assert.equal(seen[0]!.headers.get("x-client-info"), "supabase-js-node/test");
});

test("modern secret preserves unrelated Authorization values", async () => {
  const key = "sb_secret_example";
  const { fetcher, seen } = createRecordingFetch();
  const adminFetch = createSupabaseAdminFetch(key, fetcher);

  await adminFetch("https://example.invalid/rest/v1/private", {
    headers: {
      apikey: key,
      Authorization: "Bearer user-session-jwt",
    },
  });

  assert.equal(seen[0]!.headers.get("authorization"), "Bearer user-session-jwt");
});

test("legacy service_role keeps the existing Bearer behavior", async () => {
  const key = "legacy-service-role-jwt";
  const { fetcher, seen } = createRecordingFetch();
  const adminFetch = createSupabaseAdminFetch(key, fetcher);

  await adminFetch("https://example.invalid/rest/v1/private", {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  assert.equal(seen[0]!.headers.get("apikey"), key);
  assert.equal(seen[0]!.headers.get("authorization"), `Bearer ${key}`);
});

test("publishable key fails closed before any privileged request", () => {
  const { fetcher, seen } = createRecordingFetch();

  assert.throws(
    () => createSupabaseAdminFetch("sb_publishable_example", fetcher),
    /must not be publishable/,
  );
  assert.equal(seen.length, 0);
});

test("admin client wires the protected fetch seam", () => {
  const source = readFileSync("lib/supabase/admin.ts", "utf8");

  assert.match(source, /createSupabaseAdminFetch\(serviceRoleKey\)/);
  assert.match(source, /global:\s*\{\s*fetch:/);
});
