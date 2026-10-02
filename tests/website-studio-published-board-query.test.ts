import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("published board helper filters published + board and returns safe fields only", () => {
  const source = fs.readFileSync("lib/website-studio/websiteStudioPublishedBoard.ts", "utf8");
  assert.match(source, /\.eq\("status", "published"\)/);
  assert.match(source, /\.eq\("origin_board_id", normalizedBoardId\)/);
  assert.match(source, /select\("id,title,slug,template_id,origin_day,published_at,updated_at,safety_status"\)/);
  assert.doesNotMatch(source, /owner_user_id|full_document|html|css|safety_summary_json|prompt|response/i);
});
