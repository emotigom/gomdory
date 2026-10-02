import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildSupabaseApiKeyHeaders } = require(
  path.join(process.cwd(), "scripts", "supabase-api-key-headers.cjs"),
);

test("modern Supabase secret keys use apikey without Bearer authorization", () => {
  const headers = buildSupabaseApiKeyHeaders("sb_secret_example");

  assert.equal(headers.apikey, "sb_secret_example");
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers["Content-Type"], "application/json");
});

test("legacy service_role JWT keeps Bearer authorization during migration", () => {
  const headers = buildSupabaseApiKeyHeaders("legacy-service-role-jwt");

  assert.equal(headers.apikey, "legacy-service-role-jwt");
  assert.equal(headers.Authorization, "Bearer legacy-service-role-jwt");
});

test("caller headers are preserved without changing modern secret semantics", () => {
  const headers = buildSupabaseApiKeyHeaders("sb_secret_example", {
    Accept: "application/json",
    Prefer: "return=representation",
  });

  assert.equal(headers.apikey, "sb_secret_example");
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.Accept, "application/json");
  assert.equal(headers.Prefer, "return=representation");
});

test("publishable key fails closed in privileged smoke helper", () => {
  assert.throws(
    () => buildSupabaseApiKeyHeaders("sb_publishable_example"),
    /must not be publishable/,
  );
});

test("missing Supabase API key fails closed", () => {
  assert.throws(
    () => buildSupabaseApiKeyHeaders(""),
    /Supabase privileged API key is required/,
  );
});
