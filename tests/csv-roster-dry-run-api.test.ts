import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as dryRunPost } from "@/app/api/v1/dashboard/roster/csv-dry-run/route";

const URL = "http://localhost/api/v1/dashboard/roster/csv-dry-run";

function requestWithJson(body: unknown) {
  return new NextRequest(new Request(URL, { method: "POST", body: JSON.stringify(body) }));
}

test("route file exists", async () => {
  const route = await readFile("app/api/v1/dashboard/roster/csv-dry-run/route.ts", "utf8");
  assert.match(route, /requireUserApi/);
  assert.match(route, /ENABLE_CSV_ROSTER_DRY_RUN_API/);
  assert.match(route, /parseCsvRosterDryRun/);
});

test("endpoint requires auth", async () => {
  const response = await dryRunPost(requestWithJson({ csvText: "class_name,role,display_label\nA,student,Kim" }), undefined, {
    env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
    requireUserApiFn: async () => {
      throw new Error("unauthorized");
    },
  });
  assert.equal(response.status, 401);
});

test("feature flag gate blocks when missing", async () => {
  const response = await dryRunPost(requestWithJson({ csvText: "class_name,role,display_label\nA,student,Kim" }), undefined, {
    env: {},
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
  });
  const body = (await response.json()) as { ok: boolean; error?: { code?: string } };
  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error?.code, "feature_disabled");
});

test("csvText required and must be non-empty", async () => {
  const response = await dryRunPost(requestWithJson({ csvText: "   " }), undefined, {
    env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
  });
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 400);
  assert.equal(body.error?.code, "csv_text_required");
});

test("non-string csvText rejected", async () => {
  const response = await dryRunPost(requestWithJson({ csvText: 123 }), undefined, {
    env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
  });
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 400);
  assert.equal(body.error?.code, "invalid_body");
});

test("oversized csvText rejected", async () => {
  const response = await dryRunPost(requestWithJson({ csvText: "a".repeat(513 * 1024) }), undefined, {
    env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
  });
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 413);
  assert.equal(body.error?.code, "csv_too_large");
});

test("valid CSV returns ok=true and summary", async () => {
  const response = await dryRunPost(
    requestWithJson({
      csvText: "class_name,role,display_label,external_id\nA,teacher,Kim,t-1\nA,student,Lee,s-1",
      options: { maxRows: 500, maxPreviewRows: 20 },
    }),
    undefined,
    {
      env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
      requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    },
  );
  const body = (await response.json()) as { ok: boolean; result?: { ok?: boolean; summary?: { totalRows?: number } } };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.result?.ok, true);
  assert.equal(body.result?.summary?.totalRows, 2);
});

test("sensitive column returns parser issue and no sensitive values in rows", async () => {
  const response = await dryRunPost(
    requestWithJson({ csvText: "class_name,role,display_label,phone\nA,student,Kim,01012341234" }),
    undefined,
    {
      env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
      requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    },
  );

  const body = (await response.json()) as {
    ok: boolean;
    result?: {
      ok?: boolean;
      errors?: Array<{ code?: string }>;
      rows?: Array<Record<string, unknown>>;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.result?.ok, false);
  assert.ok(body.result?.errors?.some((error) => error.code === "sensitive_column_detected"));
  assert.equal(body.result?.rows?.[0]?.phone, undefined);
  assert.equal(JSON.stringify(body).includes("01012341234"), false);
});

test("parser validation errors return http 200 with result.ok=false", async () => {
  const response = await dryRunPost(
    requestWithJson({ csvText: "class_name,display_label\nA,Kim" }),
    undefined,
    {
      env: { ENABLE_CSV_ROSTER_DRY_RUN_API: "true" },
      requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    },
  );
  const body = (await response.json()) as { ok: boolean; result?: { ok?: boolean } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.result?.ok, false);
});
