import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { validateCommentBody } from "@/lib/community/commentValidation";

test("community comment body validation trims and caps to 2000", () => {
  const body = validateCommentBody(`  ${"a".repeat(2100)}  `);
  assert.equal(body.length, 2000);
});

test("community comment body validation rejects empty body", () => {
  assert.throws(() => validateCommentBody("   "), /댓글 내용을 입력해 주세요/);
});

test("successor baseline includes authenticated community comment write + owner/mod delete guards", async () => {
  const baseline = await readFile("supabase/migrations/20260929093150_successor_baseline.sql", "utf8");

  assert.match(baseline, /create policy community_comments_insert on public\.community_comments as permissive for insert to authenticated/i);
  assert.match(baseline, /auth\.uid\(\) = author_user_id/i);
  assert.match(baseline, /create policy community_comments_soft_delete_owner_or_mod on public\.community_comments as permissive for update to authenticated/i);
  assert.match(baseline, /community_is_moderator\(auth\.uid\(\)\)/i);
});

test("deleteComment action contains source-level owner/mod scoped soft-delete guard", async () => {
  const source = await readFile("app/(marketing)/community/actions.ts", "utf8");

  assert.match(source, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(source, /isModerator \? deleteQuery : deleteQuery\.eq\("author_user_id", user\.id\)/);
});
