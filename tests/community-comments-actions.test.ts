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

test("community comments migration includes authenticated write + owner/mod delete guards", async () => {
  const migration = await readFile("supabase/migrations/20260218150000_community_comments_v1_soft_delete.sql", "utf8");

  assert.match(migration, /create policy "community_comments_insert"/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /auth\.uid\(\) = author_user_id/);
  assert.match(migration, /create policy "community_comments_soft_delete_owner_or_mod"/);
  assert.match(migration, /public\.community_is_moderator\(auth\.uid\(\)\)/);
});

test("deleteComment action contains source-level owner/mod scoped soft-delete guard", async () => {
  const source = await readFile("app/(marketing)/community/actions.ts", "utf8");

  assert.match(source, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(source, /isModerator \? deleteQuery : deleteQuery\.eq\("author_user_id", user\.id\)/);
});
