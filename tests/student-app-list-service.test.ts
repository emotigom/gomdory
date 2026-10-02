import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { listStudentAppDeployments } from "@/lib/student-apps/listStudentAppDeployments";

test("board owner mismatch throws forbidden_board", async () => {
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: "other" }, error: null }) }) }) }),
  };
  await assert.rejects(() => listStudentAppDeployments({ supabase: supabase as never, userId: "u1", boardId: "b1" }), /forbidden_board/);
});

test("successful list returns metadata only", async () => {
  const supabase = {
    from: (table: string) => table === "boards"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: "u1" }, error: null }) }) }) }
      : { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "d1", board_id: "b1", card_id: "c1", title: "t", slug: "s", version: 1, status: "stored", file_count: 2, total_size_bytes: 123, entry_file: "index.html", created_at: "2026", stored_at: "2026", approved_at: null, published_at: null, archived_at: null }], error: null }) }) }) }) }) },
  };
  const res = await listStudentAppDeployments({ supabase: supabase as never, userId: "u1", boardId: "b1" });
  assert.equal(res.ok, true);
  assert.equal(res.deployments[0]?.id, "d1");
  assert.equal("r2Prefix" in (res.deployments[0] as Record<string, unknown>), false);
  assert.equal("manifest" in (res.deployments[0] as Record<string, unknown>), false);
  assert.equal("r2Key" in (res.deployments[0] as Record<string, unknown>), false);
  assert.equal(res.deployments[0]?.publicUrl, null);
});

test("limit is clamped to max 50", async () => {
  let captured = 0;
  const supabase = {
    from: (table: string) => table === "boards"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: "u1" }, error: null }) }) }) }
      : { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: async (n: number) => { captured = n; return { data: [], error: null }; } }) }) }) }) },
  };
  await listStudentAppDeployments({ supabase: supabase as never, userId: "u1", boardId: "b1", limit: 999 });
  assert.equal(captured, 50);
});

test("query failure maps to storage_schema_unavailable", async () => {
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "fail" } }) }) }) }),
  };
  await assert.rejects(() => listStudentAppDeployments({ supabase: supabase as never, userId: "u1", boardId: "b1" }), /storage_schema_unavailable/);
});

test("source guard forbids r2/crypto/buffer imports", () => {
  const source = readFileSync("lib/student-apps/listStudentAppDeployments.ts", "utf8");
  assert.doesNotMatch(source, /cloudflare:env|EDU_BUCKET|node:crypto|node:buffer|R2Bucket/);
});


test("publicUrl present only for published", async () => {
  const supabase = {
    from: (table: string) => table === "boards"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "b1", owner_id: "u1" }, error: null }) }) }) }
      : { select: () => ({ eq: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "d1", board_id: "b1", card_id: null, title: "t", slug: "s", version: 1, status: "published", file_count: 1, total_size_bytes: 1, entry_file: "index.html", created_at: "2026", stored_at: null, approved_at: null, published_at: "2026", archived_at: null }], error: null }) }) }) }) }) },
  };
  const res = await listStudentAppDeployments({ supabase: supabase as never, userId: "u1", boardId: "b1" });
  assert.equal(res.deployments[0]?.publicUrl, "https://eduview.gkrry.com/apps/d1/");
});
