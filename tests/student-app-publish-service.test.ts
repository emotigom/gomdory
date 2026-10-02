import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { publishStudentAppDeployment, unpublishStudentAppDeployment } from "@/lib/student-apps/publishStudentAppDeployment";

function makeSupabase(boardOwner = "u1", deployment: any = null) {
  const row = deployment;
  return { from: (table: string) => table === "boards" ? ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: boardOwner }, error: null }) }) }) }) : ({ select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }), update: (values: any) => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { ...row, ...values, board_id: row.board_id ?? "b1", published_at: values.published_at ?? null }, error: null }) }) }) }) }) }) } as any;
}

const dep = (status = "stored", published_at: string | null = null) => ({ id: "d1", board_id: "b1", title: "t", slug: "s", version: 1, status, file_count: 2, total_size_bytes: 10, entry_file: "index.html", published_at });

test("board owner mismatch => forbidden_board", async () => { await assert.rejects(() => publishStudentAppDeployment({ supabase: makeSupabase("other", dep()) as never, userId: "u1", boardId: "b1", deploymentId: "d1" }), /forbidden_board/); });
test("missing deployment => deployment_not_found", async () => { await assert.rejects(() => publishStudentAppDeployment({ supabase: makeSupabase("u1", null) as never, userId: "u1", boardId: "b1", deploymentId: "d1" }), /deployment_not_found/); });
test("stored publishes + already published idempotent + no secrets", async () => {
  const stored = await publishStudentAppDeployment({ supabase: makeSupabase("u1", dep("stored", null)) as never, userId: "u1", boardId: "b1", deploymentId: "d1" });
  assert.equal(stored.deployment.status, "published"); assert.equal(stored.deployment.publicUrl, "https://eduview.gkrry.com/apps/d1/");
  const published = await publishStudentAppDeployment({ supabase: makeSupabase("u1", dep("published", "2026-01-01")) as never, userId: "u1", boardId: "b1", deploymentId: "d1" });
  assert.equal(published.deployment.status, "published");
  assert.equal("r2Prefix" in (published.deployment as any), false); assert.equal("r2Key" in (published.deployment as any), false); assert.equal("manifest" in (published.deployment as any), false);
});
test("blocked/archived rejected", async () => {
  await assert.rejects(() => publishStudentAppDeployment({ supabase: makeSupabase("u1", dep("blocked")) as never, userId: "u1", boardId: "b1", deploymentId: "d1" }), /deployment_not_publishable/);
  await assert.rejects(() => publishStudentAppDeployment({ supabase: makeSupabase("u1", dep("archived")) as never, userId: "u1", boardId: "b1", deploymentId: "d1" }), /deployment_not_publishable/);
});
test("unpublish published ok; non-published rejected", async () => {
  const res = await unpublishStudentAppDeployment({ supabase: makeSupabase("u1", dep("published", "2026")) as never, userId: "u1", boardId: "b1", deploymentId: "d1" });
  assert.equal(res.deployment.status, "stored"); assert.equal(res.deployment.publishedAt, null);
  await assert.rejects(() => unpublishStudentAppDeployment({ supabase: makeSupabase("u1", dep("stored", null)) as never, userId: "u1", boardId: "b1", deploymentId: "d1" }), /deployment_not_publishable/);
});

test("source guard", () => { const source = readFileSync("lib/student-apps/publishStudentAppDeployment.ts", "utf8"); assert.doesNotMatch(source, /cloudflare:env|EDU_BUCKET|R2Bucket|node:crypto|node:buffer/); });
