import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { storeStudentAppDeployment } from "@/lib/student-apps/storeStudentAppDeployment";

function fakeBucket(failDelete = false) {
  const puts: string[] = [];
  const deletes: string[] = [];
  return {
    puts,
    deletes,
    bucket: {
      put: async (key: string) => { puts.push(key); return {} as R2Object; },
      delete: async (key: string) => { deletes.push(key); if (failDelete) throw new Error("x"); },
    } as unknown as R2Bucket,
  };
}

function createSupabaseMock(opts?: { filesError?: { message: string }; filesData?: Array<{ id: string }> }) {
  const calls: string[] = [];
  let deploymentDeleteCalls = 0;
  let fileSelectUsedSingle = false;
  const filesData = opts?.filesData ?? [{ id: "f1" }];

  const supabase: any = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "board1", owner_id: "u1", class_id: null }, error: null }) }) }),
      insert: (_value: unknown) => {
        calls.push(table);
        if (table === "student_app_deployments") {
          return {
            select: () => ({
              single: async () => ({ data: { id: "dep", board_id: "board1", card_id: null, status: "stored", title: "T", slug: "t", version: 1, file_count: 1, total_size_bytes: 2, entry_file: "index.html", created_at: "c", stored_at: "s" }, error: null }),
            }),
          };
        }

        return {
          select: () => ({
            data: opts?.filesError ? null : filesData,
            error: opts?.filesError ?? null,
            single: async () => {
              fileSelectUsedSingle = true;
              return { data: filesData[0] ?? null, error: opts?.filesError ?? null };
            },
          }),
        };
      },
      delete: () => ({ eq: async () => { if (table === "student_app_deployments") deploymentDeleteCalls += 1; return { error: null }; } }),
    }),
  };

  return { supabase, calls, getDeploymentDeleteCalls: () => deploymentDeleteCalls, fileSelectUsedSingle: () => fileSelectUsedSingle };
}

test("validation failure does not write r2 or db", async () => {
  const b = fakeBucket();
  let inserts = 0;
  const supabase: any = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: "u1", class_id: null }, error: null }) }) }), insert: () => { inserts += 1; return { select: () => ({ single: async () => ({ data: {}, error: null }) }) }; }, delete: () => ({ eq: async () => ({ error: null }) }) }) };
  const result = await storeStudentAppDeployment({ bucket: b.bucket, supabase, userId: "u1", boardId: "board1", rawPayload: { files: [{ name: "main.js", contentText: "x" }] } });
  assert.equal(result.ok, false);
  assert.equal(b.puts.length, 0);
  assert.equal(inserts, 0);
});

test("multiple file metadata insert succeeds without public or private storage keys", async () => {
  const b = fakeBucket();
  const mock = createSupabaseMock({ filesData: [{ id: "f1" }, { id: "f2" }, { id: "f3" }] });
  const result: any = await storeStudentAppDeployment({
    bucket: b.bucket,
    supabase: mock.supabase,
    userId: "u1",
    boardId: "board1",
    rawPayload: {
      files: [
        { name: "index.html", contentText: "<html></html>" },
        { name: "styles/app.css", contentText: "body{}" },
        { name: "scripts/app.js", contentText: "console.log(1);" },
      ],
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.deployment.fileCount, 1);
  assert.equal(mock.fileSelectUsedSingle(), false);
  assert.equal(JSON.stringify(result).includes("publicUrl"), false);
  assert.equal(JSON.stringify(result).includes("r2Prefix"), false);
  assert.equal(JSON.stringify(result).includes("manifestKey"), false);
  assert.equal("storage" in result, false);
});

test("mismatched inserted row count triggers rollback and storage_schema_unavailable", async () => {
  const b = fakeBucket();
  const mock = createSupabaseMock({ filesData: [{ id: "f1" }] });
  await assert.rejects(
    () => storeStudentAppDeployment({
      bucket: b.bucket,
      supabase: mock.supabase,
      userId: "u1",
      boardId: "board1",
      rawPayload: { files: [{ name: "index.html", contentText: "ok" }, { name: "scripts/app.js", contentText: "console.log(1)" }] },
    }),
    (err: any) => err?.message === "storage_schema_unavailable" && err?.code === "storage_schema_unavailable",
  );
  assert.equal(mock.getDeploymentDeleteCalls(), 1);
  assert.ok(b.deletes.length > 0);
});

test("file metadata insert error rolls back deployment and r2 objects", async () => {
  const b = fakeBucket();
  const mock = createSupabaseMock({ filesError: { message: "insert failed" } });
  await assert.rejects(
    () => storeStudentAppDeployment({ bucket: b.bucket, supabase: mock.supabase, userId: "u1", boardId: "board1", rawPayload: { files: [{ name: "index.html", contentText: "ok" }] } }),
    /storage_schema_unavailable/,
  );
  assert.equal(mock.getDeploymentDeleteCalls(), 1);
  assert.ok(b.deletes.length > 0);
});

test("source guards for service helper imports", () => {
  const source = readFileSync("lib/student-apps/storeStudentAppDeployment.ts", "utf8");
  assert.doesNotMatch(source, /node:crypto|node:buffer|cloudflare:env/);
});
